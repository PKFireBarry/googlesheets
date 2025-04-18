import React from 'react';

interface ActionButtonProps {
  children: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  icon?: React.ElementType;
  className?: string;
  color?: 'default' | 'primary' | 'danger' | 'success' | 'emerald' | 'purple' | 'indigo' | 'blue' | 'gray' | 'green' | 'red';
  type?: 'button' | 'submit';
  disabled?: boolean;
  href?: string;
  target?: string;
  rel?: string;
  [key: string]: any;
}

const ActionButton = ({
  children,
  onClick,
  icon: Icon,
  className = '',
  color = 'default',
  type = 'button',
  disabled = false,
  as: Component = 'button',
  href,
  target,
  rel,
  ...props
}: ActionButtonProps & { as?: React.ElementType }) => {
  const colorClasses = {
    default: 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700',
    primary: 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-300',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    success: 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white',
    emerald: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    purple: 'bg-purple-600 hover:bg-purple-700 text-white',
    indigo: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    blue: 'bg-blue-600 hover:bg-blue-700 text-white',
    gray: 'bg-gray-600 hover:bg-gray-700 text-white',
    green: 'bg-green-600 hover:bg-green-700 text-white',
    red: 'bg-red-600 hover:bg-red-700 text-white',
  };

  // Determine component - use anchor if href is provided
  const FinalComponent = href ? 'a' : Component;

  // Determine if this is an icon-only button
  const isIconOnly = !!Icon && (!children || children === '');
  
  // Create traditional class names
  const cornerClass = isIconOnly ? 'rounded-full' : 'rounded-lg';
  const paddingClass = isIconOnly ? 'p-2' : 'px-4 py-2';
  const baseClass = 'inline-flex items-center justify-center font-medium text-sm transition-all duration-150';
  const effectClass = 'shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2';
  const disabledClass = disabled ? 'opacity-50 cursor-not-allowed' : '';

  // Create a combined class string
  const combinedClasses = `action-button-new ${colorClasses[color] || colorClasses.default} ${cornerClass} ${paddingClass} ${baseClass} ${effectClass} ${disabledClass} ${className}`;

  // Create direct inline styles as a fallback
  const inlineStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: isIconOnly ? '9999px' : '0.5rem',
    padding: isIconOnly ? '0.5rem' : '0.5rem 1rem',
    fontWeight: 500,
    fontSize: '0.875rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    transition: 'all 150ms ease',
  };

  // Handle anchor props if using href
  const anchorProps = href ? { href, target, rel } : {};

  return (
    <FinalComponent
      type={!href ? type : undefined}
      onClick={onClick}
      disabled={disabled}
      className={combinedClasses}
      style={inlineStyles}
      {...anchorProps}
      {...props}
    >
      {Icon && <Icon className="h-4 w-4 mr-2 flex-shrink-0" />}
      {children}
    </FinalComponent>
  );
};

export default ActionButton; 