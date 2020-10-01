import route53 = require('@aws-cdk/aws-route53');
import cdk = require('@aws-cdk/core');
import eks = require('@aws-cdk/aws-eks');
import iam = require('@aws-cdk/aws-iam');
import autoscaling = require('@aws-cdk/aws-autoscaling');
import ec2 = require('@aws-cdk/aws-ec2');
import { Tags } from '@aws-cdk/core';
import { ManagedPolicy } from '@aws-cdk/aws-iam';
import { HelmChart } from '@aws-cdk/aws-eks';
import { EKSResult } from './eks-stack';

export interface BlockDevice {
  readonly deviceName: string;
  readonly size: number; // in GB
}

export interface AutoScalerProps {
  readonly instanceType?: string;
  readonly minCapacity?: number;
  readonly k8nVersion?: string;
  readonly autoscalerVersion?: string;
  readonly autoscalerNamespace?: string;
  readonly blockDevices?: BlockDevice[];
}

export function autoscaler(stack: cdk.Stack, eksr: EKSResult, props: AutoScalerProps) {
  const workerRole = new iam.Role(stack, `Role-${eksr.props.baseName}-Worker`, {
    assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
  });
  workerRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'));
  const onDemandASG = new autoscaling.AutoScalingGroup(stack, `ASG-${eksr.props.baseName}`, {
    vpc: eksr.eks.vpc,
    role: workerRole,
    minCapacity: props.minCapacity || 1,
    maxCapacity: 10,
    instanceType: new ec2.InstanceType(props.instanceType || 't3.medium'),
    machineImage: new eks.EksOptimizedImage({
      kubernetesVersion: props.k8nVersion || '1.17',
      nodeType: eks.NodeType.STANDARD, // without this, incorrect SSM parameter for AMI is resolved
    }),
    blockDevices: props.blockDevices?.map((i) => {
      return {
        deviceName: i.deviceName,
        volume: autoscaling.BlockDeviceVolume.ebs(i.size),
      };
    }),
    updateType: autoscaling.UpdateType.ROLLING_UPDATE,
  });

  Tags.of(onDemandASG).add(`k8s.io/cluster-autoscaler/${eksr.props.baseName}`, 'owned', {
    applyToLaunchedInstances: true,
  });
  Tags.of(onDemandASG).add('k8s.io/cluster-autoscaler/enabled', 'owned', {
    applyToLaunchedInstances: true,
  });
  eksr.eks.connectAutoScalingGroupCapacity(onDemandASG, {});

  const autoscalerNS = props.autoscalerNamespace || 'kuber';
  const kuberNS = eksr.eks.addManifest(`NS-${eksr.props.baseName}-${autoscalerNS}-clusterAS`, {
    apiVersion: 'v1',
    kind: 'Namespace',
    metadata: { name: autoscalerNS },
  });
  const clusterAS = eksr.eks.addServiceAccount(`SA-${eksr.props.baseName}-clusterAS`, {
    name: autoscalerNS,
    namespace: autoscalerNS,
  });
  clusterAS.node.addDependency(kuberNS);

  clusterAS.role.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'));
  eksr.eks.addManifest(`CRB-${eksr.props.baseName}-clusterAS`, {
    apiVersion: 'rbac.authorization.k8s.io/v1beta1',
    kind: 'ClusterRoleBinding',
    metadata: {
      name: `${eksr.props.baseName}-clusterAS`,
    },
    roleRef: {
      apiGroup: 'rbac.authorization.k8s.io',
      kind: 'ClusterRole',
      name: 'cluster-admin',
    },
    subjects: [
      {
        kind: 'ServiceAccount',
        name: clusterAS.serviceAccountName,
        namespace: clusterAS.serviceAccountNamespace,
      },
    ],
  }).node.addDependency(kuberNS);

  new HelmChart(stack, `HELM-${eksr.props.baseName}-autoscaler`, {
    cluster: eksr.eks,
    release: 'autoscaler',
    namespace: clusterAS.serviceAccountNamespace,
    chart: 'cluster-autoscaler-chart',
    repository: 'https://kubernetes.github.io/autoscaler',
    version: props.autoscalerVersion || '1.0.1',
    values: {
      awsRegion: stack.region,
      autoDiscovery: {
        clusterName: eksr.eks.clusterName,
      },
      rbac: {
        serviceAccount: {
          create: false,
          name: clusterAS.serviceAccountName,
        },
      },
    },
  }).node.addDependency(kuberNS);
  return onDemandASG;
}
