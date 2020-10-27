import * as aws from "@pulumi/aws";
import * as k8s from "@pulumi/kubernetes";
import { ProviderResource } from '@pulumi/pulumi';
import { buildServiceAccountRole } from './build-service-account-role';

export interface ExternalDNSProps {
  readonly externalDnsNamespace?: string; // default external
  readonly externalDnsImage?: string; // default registry.opensource.zalan.do/teapot/external-dns:latest
  readonly zones: aws.route53.Zone[];

  readonly accountId: string;
  readonly oidcId: string;
  readonly name?: string;
  readonly provider?: ProviderResource
}

export async function externalDNS(props: ExternalDNSProps) {
  const toolsNS = props.externalDnsNamespace || 'kuber';

  const saName = `SA-${toolsNS}-${props.name || 'external-dns'}`;
  const dnsAdmin = await buildServiceAccountRole({
    newRole: {
      name: saName,
      namespace: toolsNS,
      accountId: props.accountId,
      oidcId: props.oidcId,
    },
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: 'Allow',
          Action: ['route53:ChangeResourceRecordSets'],
          Resource: ['arn:aws:route53:::hostedzone/*'],
        },
        {
          Effect: 'Allow',
          Action: ['route53:ListHostedZones', 'route53:ListResourceRecordSets'],
          Resource: ['*'],
        }
      ]
    }
  });

  const ns = new k8s.core.v1.Namespace(
    `ns-${toolsNS}-delegation53`,
    {
      metadata: {
        name: toolsNS,
      },
    },
    { provider: props.provider }
  );

  new k8s.rbac.v1.ClusterRoleBinding(`CRB-${toolsNS}-viewer`, {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'ClusterRoleBinding',
      metadata: {
        name: `${toolsNS}-externaldns-viewer`,
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'ClusterRole',
        name: `${toolsNS}-externaldns-viewer`,
      },
      subjects: [
        {
          kind: 'ServiceAccount',
          name: saName,
          namespace: toolsNS
        },
      ],
    })

  new k8s.rbac.v1.ClusterRole(`CR-${toolsNS}-viewer`, {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'ClusterRole',
      metadata: { name: `${toolsNS}-externaldns-viewer` },
      rules: [
        {
          apiGroups: [''],
          resources: ['services', 'endpoints', 'pods'],
          verbs: ['get', 'watch', 'list'],
        },
        {
          apiGroups: ['extensions', 'networking.k8s.io'],
          resources: ['ingresses'],
          verbs: ['get', 'watch', 'list'],
        },
        {
          apiGroups: [''],
          resources: ['nodes'],
          verbs: ['list', 'watch'],
        },
      ],
    })

  const externalDnsImage =
    props.externalDnsImage || 'registry.opensource.zalan.do/teapot/external-dns:latest';

  new k8s.apps.v1.Deployment(`Deployment-${toolsNS}-externaldns`, {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: `${toolsNS}-externaldns`,
        namespace: toolsNS
      },
      spec: {
        strategy: { type: 'Recreate' },
        selector: {
          matchLabels: {
            app: `${toolsNS}-externaldns`,
          },
        },
        template: {
          metadata: {
            labels: {
              app: `${toolsNS}-externaldns`,
            },
          },
          spec: {
            serviceAccount: dnsAdmin.arn,
            containers: [
              {
                name: 'externaldns',
                image: externalDnsImage,
                args: [
                  '--source=service',
                  '--source=ingress',
                  ...props.zones.map((zone) => `--domain-filter=${zone.name}`),
                  '--provider=aws',
                  '--policy=upsert-only',
                  '--aws-zone-type=public',
                  '--registry=txt',
                  `--txt-owner-id=${toolsNS}-externaldns`,
                ],
              },
            ],
            securityContext: {
              fsGroup: 65534,
            },
          },
        },
      },
    })
}
