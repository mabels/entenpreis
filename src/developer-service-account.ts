import eks = require('@aws-cdk/aws-eks');
import { ManagedPolicy } from '@aws-cdk/aws-iam';
import { EKSResult } from './eks-stack';

export interface DeveloperServiceAccountProps {
  readonly developerNS?: string;
}

export function developerServiceAccount(eksr: EKSResult, props: DeveloperServiceAccountProps) {
  const developerNS = props.developerNS || 'developer';

  const devAdmin = eksr.eks.addServiceAccount(
    `SA-${eksr.props.baseName}-${developerNS}-developer`,
    {
      name: developerNS,
      namespace: developerNS,
    },
  );

  const nsDeveloper = eksr.eks.addManifest(`NS-${eksr.props.baseName}-${developerNS}`, {
    apiVersion: 'v1',
    kind: 'Namespace',
    metadata: { name: developerNS },
  });
  devAdmin.node.addDependency(nsDeveloper);

  devAdmin.role.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'));

  eksr.eks.addManifest(`CRB-${eksr.props.baseName}-${developerNS}-binding`, {
    apiVersion: 'rbac.authorization.k8s.io/v1beta1',
    kind: 'ClusterRoleBinding',
    metadata: {
      name: `${developerNS}-binding`,
    },
    roleRef: {
      apiGroup: 'rbac.authorization.k8s.io',
      kind: 'ClusterRole',
      name: 'cluster-admin',
    },
    subjects: [
      {
        kind: 'ServiceAccount',
        name: devAdmin.serviceAccountName,
        namespace: devAdmin.serviceAccountNamespace,
      },
    ],
  });
  return devAdmin;
}
