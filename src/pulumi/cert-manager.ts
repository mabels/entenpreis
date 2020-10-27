import * as k8s from "@pulumi/kubernetes";
// import * as k8sx from "@pulumi/kubernetesx";
import { Input, ProviderResource } from "@pulumi/pulumi";
import { deserializeProperties } from "@pulumi/pulumi/runtime";
import { buildAffinity } from './build-affinity';
import { buildServiceAccountRole } from './build-service-account-role';

export interface CertManagerProps {
  readonly version?: string;
  readonly namespace?: string;
  readonly provider?: ProviderResource;
  readonly installCRDs?: boolean;
  readonly name?: string;
  readonly role?: string;
  readonly accountId: string;
  readonly oidcId: string;
  readonly nodeGroup?: string;
}

export async function certManager(props: CertManagerProps) {
  const name = props.name || "cert-manager";
  const nsStr = props.namespace || "cert-manager";

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

  const ns = new k8s.core.v1.Namespace(
    `ns-${nsStr}`,
    {
      metadata: {
        name: nsStr,
      },
    },
    { provider: props.provider }
  );
  const certManager = new k8s.helm.v3.Chart(
    props.name || "cert-manager",
    {
      fetchOpts: {
        repo: "https://charts.jetstack.io",
      },
      // repo: 'stable',
      chart: "cert-manager",
      version: props.version || "v1.0.3",
      namespace: nsStr,
      values: {
        installCRDs: props.installCRDs || false,
        extraArgs: ["--issuer-ambient-credentials"],
        securityContext: {
          fsGroup: 1000,
        },
        serviceAccount: {
          annotations: {
            "eks.amazonaws.com/role-arn": role.arn,
          },
        },
        ...buildAffinity(props)
      },
    },
    { provider: props.provider, dependsOn: ns }
  );

  //     helm install \
  //   cert-manager jetstack/cert-manager \
  //   --namespace cert-manager \
  //   --version v1.0.3 \
  //   # --set installCRDs=true
  // --set installCRDs=true
  // const certManager = new k8s.yaml.ConfigFile(`https://github.com/jetstack/cert-manager/releases/download/${props.version || 'v1.0.2'}/cert-manager.yaml`);
  return certManager;
}
