type Size = 'sm' | 'md' | 'lg';

const SIZES: Record<Size, { mark: string; word: string; tag: string; gap: string }> = {
  sm: { mark: 'h-8', word: 'text-xl', tag: 'text-[10px]', gap: 'gap-2' },
  md: { mark: 'h-12', word: 'text-3xl', tag: 'text-xs', gap: 'gap-2.5' },
  lg: { mark: 'h-24', word: 'text-5xl', tag: 'text-sm', gap: 'gap-3' },
};

type Props = {
  size?: Size;
  /** vertical = mark stacked above wordmark (login); horizontal = side by side (sidebar header) */
  orientation?: 'vertical' | 'horizontal';
  withTagline?: boolean;
  withMark?: boolean;
  className?: string;
};

/**
 * TorBot brand lockup. The wordmark (TOR=blue, BOT=green) is pure CSS and always
 * renders. The robot mark is an optional image at /brand/torbot-mark.png — if the
 * file isn't present yet it hides itself gracefully (no broken-image icon).
 */
export default function Logo({
  size = 'md',
  orientation = 'vertical',
  withTagline = false,
  withMark = true,
  className = '',
}: Props) {
  const s = SIZES[size];

  const mark = withMark && (
    <img
      src={`${import.meta.env.BASE_URL}brand/torbot-mark.png`}
      alt="TorBot"
      className={`${s.mark} w-auto object-contain`}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = 'none';
      }}
    />
  );

  const wordmark = (
    <div className="flex flex-col items-center">
      <span className={`font-extrabold tracking-tight leading-none ${s.word}`} dir="ltr">
        <span className="text-primary-600">TOR</span>
        <span className="text-accent-600">BOT</span>
      </span>
      {withTagline && (
        <span className={`text-gray-400 font-medium mt-1 ${s.tag}`}>זימון תורים חכם ומהיר</span>
      )}
    </div>
  );

  return (
    <div
      className={`flex items-center justify-center ${
        orientation === 'vertical' ? 'flex-col' : 'flex-row'
      } ${s.gap} ${className}`}
    >
      {mark}
      {wordmark}
    </div>
  );
}
