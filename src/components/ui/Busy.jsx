import Icon from './Icon';

/** A button's label and icon, swapped for a spinner and "Saving…" while it works. */
export default function Busy({ busy, icon, label, busyLabel = 'Saving…', size = 18 }) {
  if (busy) {
    return (
      <>
        <Icon name="sync" size={size} className="motion-safe:animate-spin" />
        {busyLabel}
      </>
    );
  }
  return (
    <>
      {icon && <Icon name={icon} size={size} />}
      {label}
    </>
  );
}
