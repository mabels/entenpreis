import eks = require("@aws-cdk/aws-eks");
import { ManagedPolicy } from "@aws-cdk/aws-iam";

export interface DeveloperServiceAccountProps {
  readonly developerNS?: string;
}

export function developerServiceAccount(
  eksCluster: eks.Cluster,
  props: DeveloperServiceAccountProps
) {
  const developerNS = props.developerNS || "developer";

  const devAdmin = eksCluster.addServiceAccount(`${developerNS}`, {
    name: developerNS,
    namespace: developerNS,
  });

  const nsDeveloper = eksCluster.addManifest(
    `NS-${developerNS}-${eksCluster.clusterName}`,
    {
      apiVersion: "v1",
      kind: "Namespace",
      metadata: { name: developerNS },
    }
  );
  devAdmin.node.addDependency(nsDeveloper);

  devAdmin.role.addManagedPolicy(
    ManagedPolicy.fromAwsManagedPolicyName("AdministratorAccess")
  );

  eksCluster.addManifest(`${developerNS}-cluster-role-binding`, {
    apiVersion: "rbac.authorization.k8s.io/v1beta1",
    kind: "ClusterRoleBinding",
    metadata: {
      name: `${developerNS}-cluster-role-binding`,
    },
    roleRef: {
      apiGroup: "rbac.authorization.k8s.io",
      kind: "ClusterRole",
      name: "cluster-admin",
    },
    subjects: [
      {
        kind: "ServiceAccount",
        name: devAdmin.serviceAccountName,
        namespace: devAdmin.serviceAccountNamespace,
      },
    ],
  });
  return devAdmin;
}
