// import * as path from 'path'

import iam = require("@aws-cdk/aws-iam");
import ec2 = require("@aws-cdk/aws-ec2");
import eks = require("@aws-cdk/aws-eks");
import cdk = require("@aws-cdk/core");

export interface EKSProps {
  readonly baseName: string;
  readonly EKSVersion?: eks.KubernetesVersion;
  readonly cidr?: string;
  readonly vpcId?: string;
  readonly developerNS?: string;
}

export interface EKSResult {
  readonly props: EKSProps;
  readonly eks: eks.Cluster;
}

export function eksStack(stack: cdk.Stack, props: EKSProps): EKSResult {
  let myVPC: ec2.IVpc;
  if (props.vpcId) {
    myVPC = ec2.Vpc.fromLookup(stack, `VPC-${props.baseName}`, {vpcId: props.vpcId});
  } else if (props.cidr) {
    myVPC = new ec2.Vpc(stack, `VPC-${props.baseName}`, {
      cidr: props.cidr,
    });
  } else {
    throw Error("we need a vpcid or cidr")
  }

  const clusterAdmin = new iam.Role(stack, `AdminRole-${props.baseName}`, {
    assumedBy: new iam.AccountRootPrincipal(),
  });

  const eksCluster = new eks.Cluster(stack, `Cluster-${props.baseName}`, {
    clusterName: `EKS-${props.baseName}`,
    mastersRole: clusterAdmin,
    vpc: myVPC,
    kubectlEnabled: true, // we want to be able to manage k8s resources using CDK
    defaultCapacity: 0, // we want to manage capacity our selves
    version: props.EKSVersion || eks.KubernetesVersion.V1_17,
  });

  eksCluster.addManifest(`${props.baseName}-gp2-encrypted`, {
    apiVersion: "storage.k8s.io/v1",
    kind: "StorageClass",
    metadata: {
      name: "gp2-encrypted",
    },
    provisioner: "kubernetes.io/aws-ebs",
    parameters: {
      type: "gp2",
      encrypted: "true",
    },
    reclaimPolicy: "Retain",
    allowVolumeExpansion: true,
  });
  return {
    props,
    eks: eksCluster
  }
}
