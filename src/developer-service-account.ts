// import iam = require('@aws-cdk/aws-iam');
import { ManagedPolicy } from '@aws-cdk/aws-iam';
import { EKSResult } from './eks-stack';

export interface DeveloperServiceAccountProps {
  readonly developerNS?: string;
}

export function developerServiceAccount(eksr: EKSResult, props: DeveloperServiceAccountProps) {
  const developerNS = props.developerNS || 'developer';

  const nsDeveloper = eksr.eks.addManifest(`NS-${eksr.props.baseName}-${developerNS}-developer`, {
    apiVersion: 'v1',
    kind: 'Namespace',
    metadata: { name: developerNS },
  });

  const devAdmin = eksr.eks.addServiceAccount(
    `SA-${eksr.props.baseName}-${developerNS}-developer`,
    {
      name: developerNS,
      namespace: developerNS,
    },
  );
  devAdmin.node.addDependency(nsDeveloper);

  // devAdmin.role.roleName

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
  }).node.addDependency(devAdmin);
  return devAdmin;
}
