// import * as path from 'path'

import iam = require("@aws-cdk/aws-iam");
import ec2 = require("@aws-cdk/aws-ec2");
import eks = require("@aws-cdk/aws-eks");
import cdk = require("@aws-cdk/core");
import { ManagedPolicy } from "@aws-cdk/aws-iam";

export interface EKSProps {
  readonly clusterName: string;
  readonly k8nVersion?: string;
  readonly EKSk8nVersion?: eks.KubernetesVersion;
  readonly cidr?: string;
  readonly vpcId?: string;
  readonly developerNS?: string;
}

export function eksStack(stack: cdk.Stack, props: EKSProps) {
  let myVPC: ec2.IVpc;
  if (props.vpcId) {
    myVPC = ec2.Vpc.fromLookup(stack, `VPC-${props.clusterName}`, {vpcId: props.vpcId});
  } else if (props.cidr) {
    myVPC = new ec2.Vpc(stack, `VPC-${props.clusterName}`, {
      cidr: props.cidr,
    });
  } else {
    throw Error("we need a vpcid or cidr")
  }

  const clusterAdmin = new iam.Role(stack, `AdminRole-${props.clusterName}`, {
    assumedBy: new iam.AccountRootPrincipal(),
  });

  const eksCluster = new eks.Cluster(stack, `Cluster-${props.clusterName}`, {
    clusterName: `EKS-${props.clusterName}`,
    mastersRole: clusterAdmin,
    vpc: myVPC,
    kubectlEnabled: true, // we want to be able to manage k8s resources using CDK
    defaultCapacity: 0, // we want to manage capacity our selves
    version: props.EKSk8nVersion || eks.KubernetesVersion.V1_17,
  });

  eksCluster.addManifest(`${props.clusterName}-gp2-encrypted`, {
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
  return eksCluster
}
