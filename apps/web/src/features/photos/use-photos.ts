import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { Me } from '../../shared/api/auth';
import { ApiError } from '../../shared/api/http';
import {
  removeMyPhoto,
  removeTeamPhoto,
  uploadMyPhoto,
  uploadTeamPhoto,
} from '../../shared/api/photos';
import { SESSION_KEY } from '../auth/use-session';

/** Tu foto: al cambiar, la sesión (/me) se actualiza y la plantilla se vuelve a pedir. */
export function useMyPhoto() {
  const queryClient = useQueryClient();
  const onSuccess = (profile: Me['profile']) => {
    queryClient.setQueryData<Me | null>(SESSION_KEY, (me) => (me ? { ...me, profile } : me));
    void queryClient.invalidateQueries({ queryKey: ['team'] });
  };
  const upload = useMutation({ mutationFn: uploadMyPhoto, onSuccess });
  const remove = useMutation({ mutationFn: removeMyPhoto, onSuccess });
  return { upload, remove, error: photoError(upload.error ?? remove.error) };
}

/** Escudo o foto del equipo: al cambiar, el equipo y la sesión (encabezado) se actualizan. */
export function useTeamPhoto(teamId: string) {
  const queryClient = useQueryClient();
  const onSuccess = (team: unknown) => {
    queryClient.setQueryData(['team', teamId], team);
    void queryClient.invalidateQueries({ queryKey: SESSION_KEY });
  };
  const upload = useMutation({
    mutationFn: (photo: Blob) => uploadTeamPhoto(teamId, photo),
    onSuccess,
  });
  const remove = useMutation({ mutationFn: () => removeTeamPhoto(teamId), onSuccess });
  return { upload, remove, error: photoError(upload.error ?? remove.error) };
}

function photoError(error: unknown): string | null {
  if (!error) return null;
  return error instanceof ApiError && error.status < 500
    ? error.message
    : 'No pudimos guardar la foto. Revisa tu conexión e intenta de nuevo.';
}
