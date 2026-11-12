/**
 * Espera do 3D: área neutra com o contorno discreto de um copo que pulsa e um brilho roxo e
 * dourado que passa. O produto só aparece em 3D, nunca em desenho.
 * Para quem pediu menos movimento, fica parado (regra global do index.css).
 */
export function PreviewSkeleton() {
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden bg-acai-50">
      <div className="absolute inset-0 grid place-items-center">
        <div className="relative h-[60%] w-[44%] animate-pulse">
          {/* monte */}
          <div className="absolute inset-x-[5%] top-0 h-[26%] rounded-[50%_50%_0_0/100%_100%_0_0] bg-acai-200/70" />
          {/* copo */}
          <div className="absolute inset-x-0 top-[20%] bottom-0 bg-acai-100 [clip-path:polygon(0_0,100%_0,82%_100%,18%_100%)]" />
        </div>
        {/* sombra no chão */}
        <div className="absolute bottom-[14%] h-[5%] w-[36%] rounded-[50%] bg-acai-200/60 blur-sm" />
      </div>
      <div className="absolute inset-y-0 -left-full w-full animate-shimmer bg-[linear-gradient(100deg,transparent_25%,rgb(250_204_21/0.24)_45%,rgb(123_29_92/0.14)_55%,transparent_75%)]" />
    </div>
  )
}
