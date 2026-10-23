import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PhotoPicker } from './PhotoPicker';
import { Token } from './Token';

// jsdom no decodifica imágenes: la preparación se prueba en el navegador; aquí, el flujo.
vi.mock('../photos/prepare-photo', () => ({
  preparePhoto: vi.fn(async () => new Blob(['webp'], { type: 'image/webp' })),
}));
URL.createObjectURL = () => 'blob:vista-previa';
URL.revokeObjectURL = () => {};

describe('foto', () => {
  it('elegir, ver cómo queda y recién ahí subirla', async () => {
    const onUpload = vi.fn();
    render(
      <PhotoPicker
        label="Elegir tu foto"
        current={null}
        fallback="KL"
        busy={false}
        error={null}
        onUpload={onUpload}
        onRemove={() => {}}
      />,
    );
    expect(screen.getByText('Subir foto')).toBeInTheDocument();
    await userEvent.upload(
      screen.getByLabelText('Elegir tu foto'),
      new File(['jpg'], 'cancha.jpg', { type: 'image/jpeg' }),
    );
    expect(await screen.findByRole('img', { name: 'Así queda tu foto' })).toHaveAttribute(
      'src',
      'blob:vista-previa',
    );
    expect(onUpload).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Usar esta foto' }));
    expect(onUpload.mock.calls[0]![0]).toBeInstanceOf(Blob);
    expect((onUpload.mock.calls[0]![0] as Blob).type).toBe('image/webp');
  });

  it('con foto: cambiar o quitar', async () => {
    const onRemove = vi.fn();
    render(
      <PhotoPicker
        label="Elegir tu foto"
        current="/api/v1/players/x/photo?v=1"
        fallback="KL"
        busy={false}
        error="La foto tiene que ser WebP o JPEG de hasta 512 KB."
        onUpload={() => {}}
        onRemove={onRemove}
      />,
    );
    expect(screen.getByText('Cambiar foto')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('WebP o JPEG');
    await userEvent.click(screen.getByRole('button', { name: 'Quitar foto' }));
    expect(onRemove).toHaveBeenCalled();
  });

  it('la ficha muestra la foto y, si no carga, vuelve a las iniciales', () => {
    const { container } = render(<Token text="KL" photo="/api/v1/players/x/photo?v=1" />);
    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('https://api.sdl.test/api/v1/players/x/photo?v=1');
    fireEvent.error(img);
    expect(container.querySelector('img')).toBeNull();
    expect(container).toHaveTextContent('KL');
  });
});
