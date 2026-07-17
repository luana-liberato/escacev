/**
 * Marca "losango partido": um losango teal com um triângulo preto sobreposto na
 * metade direita, formando duas metades assimétricas. Paleta inspirada na logo
 * da Ação Evangélica. Especificação em docs/design/handoff.md.
 */
export function Logo({ size = 48, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 52 52"
      className={className}
      role="img"
      aria-label="Escacev"
    >
      <polygon points="26,4 48,26 26,48 4,26" fill="#1C7C8C" />
      <polygon points="26,14 40,26 26,38 26,14" fill="#1A1A1A" />
    </svg>
  );
}
