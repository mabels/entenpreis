// import * as path from 'path'

import iam = require('@aws-cdk/aws-iam');
import ec2 = require('@aws-cdk/aws-ec2');
import eks = require('@aws-cdk/aws-eks');
import cdk = require('@aws-cdk/core');

export interface EKSProps {
  readonly baseName: string;
  readonly EKSVersion?: eks.KubernetesVersion;
  readonly cidr?: string;
  readonly vpcId?: string;
  readonly developerNS?: string;
  readonly clusterAdminRoleArns?: string[];
}

export interface EKSResult {
  readonly props: EKSProps;
  readonly eks: eks.Cluster;
}

export function eksStack(stack: cdk.Stack, props: EKSProps): EKSResult {
  let myVPC: ec2.IVpc;
  if (props.vpcId) {
    myVPC = ec2.Vpc.fromLookup(stack, `VPC-${props.baseName}`, { vpcId: props.vpcId });
  } else if (props.cidr) {
    myVPC = new ec2.Vpc(stack, `VPC-${props.baseName}`, {
      cidr: props.cidr,
    });
  } else {
    throw Error('we need a vpcid or cidr');
  }

  const clusterAdmin = new iam.Role(stack, `Role-${props.baseName}-clusterAdmin`, {
    assumedBy: new iam.AccountRootPrincipal(),
  });

  const eksCluster = new eks.Cluster(stack, `EKS-${props.baseName}`, {
    clusterName: `${props.baseName}`,
    mastersRole: clusterAdmin,
    vpc: myVPC,
    kubectlEnabled: true, // we want to be able to manage k8s resources using CDK
    defaultCapacity: 0, // we want to manage capacity our selves
    version: props.EKSVersion || eks.KubernetesVersion.V1_18,
  });


  props.clusterAdminRoleArns?.forEach((i) => {
    eksCluster.awsAuth.addMastersRole(
      iam.Role.fromRoleArn(stack, `Role-eks-mainroles-${i.replace(/[^a-zA-Z0-9]+/g, '-')}`, i),
    );
  });

  eksCluster.addManifest(`SC-${props.baseName}-gp2-encrypted`, {
    apiVersion: 'storage.k8s.io/v1',
    kind: 'StorageClass',
    metadata: {
      name: 'gp2-encrypted',
    },
    provisioner: 'kubernetes.io/aws-ebs',
    parameters: {
      type: 'gp2',
      encrypted: 'true',
    },
    reclaimPolicy: 'Retain',
    allowVolumeExpansion: true,
  });
  return {
    props,
    eks: eksCluster,
  };
}

export interface NodeGroupProps {
  readonly name: string;
  readonly diskSize?: number;
  readonly desiredSize?: number;
  readonly maxSize?: number;
  readonly minSize?: number;
  readonly instanceType?: string;
  readonly labels?: { [id:string]: string };
  readonly tags?: { [id:string]: string };
  readonly nodeRole?: iam.IRole;
  readonly releaseVersion?: string;
  readonly remoteAccess?: eks.NodegroupRemoteAccess;
  readonly launchTemplateSpec?: eks.LaunchTemplateSpec;
}

export function addNodeGroup(eks: EKSResult, props: NodeGroupProps) {
  eks.eks.addNodegroupCapacity(`NG-${props.name}`, {
    nodegroupName: props.name,
    subnets: {

    },
    diskSize: props.diskSize,
    desiredSize: props.desiredSize || 1,
    maxSize: props.maxSize,
    minSize: props.minSize,
    instanceType: new ec2.InstanceType(props.instanceType || 't2a.medium'),
    labels: {
      ...props.labels,
      nodegroup: props.name
    },
    nodeRole: props.nodeRole,
    releaseVersion: props.releaseVersion,
    remoteAccess: props.remoteAccess,
    tags: {
      ...props.tags,
      nodegroup: props.name
    },
    launchTemplateSpec: props.launchTemplateSpec
  })

}
