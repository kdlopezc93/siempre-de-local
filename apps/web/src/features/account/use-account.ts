import { useMutation, useQueryClient } from '@tanstack/react-query';

import { deleteAccount, downloadMyData } from '../../shared/api/account';
import { clearApiCache } from '../../shared/offline/api-cache';
import { saveFile } from '../../shared/save-file';
import { SESSION_KEY } from '../auth/use-session';

export function useDownloadMyData() {
  return useMutation({
    mutationFn: downloadMyData,
    onSuccess: ({ blob, filename }) => saveFile(blob, filename),
  });
}

/** Al eliminarla, la sesión ya no existe: se limpia lo guardado en este celular. */
export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await deleteAccount();
      await clearApiCache();
    },
    onSuccess: () => queryClient.setQueryData(SESSION_KEY, null),
  });
}
