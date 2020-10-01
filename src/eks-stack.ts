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
  readonly clusterAdminRoleArn?: string;
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

  let clusterAdmin: iam.IRole;
  if (props.clusterAdminRoleArn) {
    clusterAdmin = iam.Role.fromRoleArn(stack, `Role-eks-mainroles-${props.clusterAdminRoleArn.replace(/[^a-zA-Z0-9]+/g, '-')}`, props.clusterAdminRoleArn);
  } else {
    clusterAdmin = new iam.Role(stack, `Role-${props.baseName}-clusterAdmin`, {
      assumedBy: new iam.AccountRootPrincipal(),
    });
  }

  const eksCluster = new eks.Cluster(stack, `EKS-${props.baseName}`, {
    clusterName: `${props.baseName}`,
    mastersRole: clusterAdmin,
    vpc: myVPC,
    kubectlEnabled: true, // we want to be able to manage k8s resources using CDK
    defaultCapacity: 0, // we want to manage capacity our selves
    version: props.EKSVersion || eks.KubernetesVersion.V1_17,
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
