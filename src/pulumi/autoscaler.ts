import * as aws from "@pulumi/aws";
import * as k8s from "@pulumi/kubernetes";
import { ProviderResource } from '@pulumi/pulumi';

/*

export interface BlockDevice {
  readonly deviceName: string;
  readonly size: number; // in GB
}

export interface AutoScalerProps {
  readonly name?: string;
  readonly instanceType?: string;
  readonly minCapacity?: number;
  readonly k8nVersion?: string;
  readonly autoscalerVersion?: string;
  readonly autoscalerNamespace?: string;
  readonly blockDevices?: BlockDevice[];
  readonly provider?: ProviderResource;
}

export function autoscaler(props: AutoScalerProps) {
  const autoscalerNS = props.autoscalerNamespace || 'autoscaler';
  const name = props.name || 'autoscaler'
  const ns = new k8s.core.v1.Namespace(
    `ns-${autoscalerNS}`,
    {
      metadata: {
        name: autoscalerNS,
      },
    },
    { provider: props.provider }
  );

  const role = await buildServiceAccountRole({
    ...(props.role ?
      { existingRole: props.role } :
      {
        newRole: {
          name: name,
          namespace: nsStr,
          accountId: props.accountId,
          oidcId: props.oidcId,
        }
      }
    ),
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: "route53:GetChange",
          Resource: "arn:aws:route53:::change/*",
        },
        {
          Effect: "Allow",
          Action: [
            "route53:ChangeResourceRecordSets",
            "route53:ListResourceRecordSets",
          ],
          Resource: "arn:aws:route53:::hostedzone/*",
        },
        {
          Effect: "Allow",
          Action: "route53:ListHostedZonesByName",
          Resource: "*",
        },
      ]
    }
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
  })

  const autoscaler = new k8s.helm.v3.Chart(`HELM-${name}-autoscaler`, {
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
  })
}
*/
