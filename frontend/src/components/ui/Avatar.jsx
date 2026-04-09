import React from 'react';

/**
 * Avatar Component for displaying user avatars (Section 0.2.7)
 * 
 * Features:
 * - Display image or initials
 * - Support for online/offline status indicator
 * - Multiple sizes
 * - Fallback to generic user icon
 */
export default function Avatar({
  src,
  initials,
  name = '',
  size = 'md',
  status = null, // 'online', 'offline', 'away', 'busy'
  className = '',
  clickable = false,
  onClick = null,
}) {
  // Size mappings
  const sizes = {
    xs: 'h-6 w-6 text-body-sm',
    sm: 'h-8 w-8 text-body-sm',
    md: 'h-10 w-10 text-body',
    lg: 'h-12 w-12 text-body-lg',
    xl: 'h-16 w-16 text-h3',
  };

  // Status indicator colors
  const statusColors = {
    online: 'bg-success',
    offline: 'bg-slate-400',
    away: 'bg-amber-400',
    busy: 'bg-error',
  };

  // Get initials from name if not provided
  const getInitials = () => {
    if (initials) return initials;
    if (!name) return '?';
    return name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0].toUpperCase())
      .join('');
  };

  const baseStyles = `inline-flex items-center justify-center rounded-full bg-primary-600 text-white font-semibold select-none ${sizes[size]} ${clickable ? 'cursor-pointer hover:ring-2 hover:ring-primary-500 hover:ring-offset-2 dark:hover:ring-offset-slate-900' : ''} transition-all duration-standard`;

  return (
    <div
      className={`relative ${clickable ? 'cursor-pointer' : ''}`}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : -1}
    >
      {/* Avatar circle */}
      {src ? (
        <img
          src={src}
          alt={name || 'User avatar'}
          className={`${baseStyles} object-cover ${className}`}
        />
      ) : (
        <div className={`${baseStyles} dark:bg-primary-700 ${className}`}>
          {getInitials()}
        </div>
      )}

      {/* Status indicator */}
      {status && (
        <div
          className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-slate-900 ${statusColors[status]}`}
          title={`Status: ${status}`}
          aria-label={`Status: ${status}`}
        />
      )}
    </div>
  );
}

/**
 * AvatarGroup - Display multiple avatars stacked
 */
export function AvatarGroup({
  avatars = [],
  max = 3,
  size = 'md',
  className = '',
}) {
  const displayedAvatars = avatars.slice(0, max);
  const overflow = Math.max(avatars.length - max, 0);

  // Size mappings for margin (negative for stacking)
  const marginSizes = {
    xs: '-ml-1.5',
    sm: '-ml-2',
    md: '-ml-2.5',
    lg: '-ml-3',
    xl: '-ml-4',
  };

  return (
    <div className={`flex items-center ${className}`}>
      {displayedAvatars.map((avatar, idx) => (
        <div
          key={idx}
          className={`${idx > 0 ? marginSizes[size] : ''} border-2 border-white dark:border-slate-900 rounded-full`}
        >
          <Avatar {...avatar} size={size} />
        </div>
      ))}

      {overflow > 0 && (
        <div
          className={`${marginSizes[size]} h-10 w-10 rounded-full bg-slate-300 dark:bg-slate-600 text-white font-semibold flex items-center justify-center text-body-sm border-2 border-white dark:border-slate-900`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}