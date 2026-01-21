import React from 'react';

/**
 * ResponsiveGrid - مكون شبكة متجاوبة موحد
 * 
 * @param {string} cols - عدد الأعمدة (1-6)
 * @param {string} gap - المسافة بين العناصر (sm, md, lg)
 * @param {React.ReactNode} children
 */
export const ResponsiveGrid = ({ 
  cols = '2', 
  gap = 'md', 
  className = '', 
  children 
}) => {
  const colsMap = {
    '1': 'grid-cols-1',
    '2': 'grid-cols-1 md:grid-cols-2',
    '3': 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    '4': 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    '5': 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
    '6': 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6'
  };

  const gapMap = {
    'sm': 'gap-2',
    'md': 'gap-4',
    'lg': 'gap-6',
    'xl': 'gap-8'
  };

  return (
    <div className={`grid ${colsMap[cols]} ${gapMap[gap]} ${className}`}>
      {children}
    </div>
  );
};

/**
 * ResponsiveCard - بطاقة متجاوبة موحدة
 */
export const ResponsiveCard = ({ 
  title, 
  icon: Icon, 
  children, 
  className = '',
  headerClassName = ''
}) => {
  return (
    <div className={`apple-card p-4 sm:p-6 ${className}`}>
      {title && (
        <div className={`flex items-center gap-3 mb-4 sm:mb-6 pb-4 border-b border-gray-100 ${headerClassName}`}>
          {Icon && (
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
              <Icon size={20} />
            </div>
          )}
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">{title}</h2>
        </div>
      )}
      {children}
    </div>
  );
};

/**
 * ResponsiveStack - مجموعة عمودية متجاوبة
 */
export const ResponsiveStack = ({ 
  spacing = 'md', 
  className = '', 
  children 
}) => {
  const spacingMap = {
    'sm': 'space-y-2',
    'md': 'space-y-4',
    'lg': 'space-y-6',
    'xl': 'space-y-8'
  };

  return (
    <div className={`${spacingMap[spacing]} ${className}`}>
      {children}
    </div>
  );
};

/**
 * ResponsiveContainer - حاوية رئيسية متجاوبة
 */
export const ResponsiveContainer = ({ 
  maxWidth = '4xl', 
  className = '', 
  children 
}) => {
  const maxWidthMap = {
    'sm': 'max-w-sm',
    'md': 'max-w-md',
    'lg': 'max-w-lg',
    'xl': 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl',
    'full': 'max-w-full'
  };

  return (
    <div className={`${maxWidthMap[maxWidth]} mx-auto px-4 sm:px-6 lg:px-8 pb-20 ${className}`}>
      {children}
    </div>
  );
};

/**
 * ResponsiveFormField - حقل نموذج متجاوب
 */
export const ResponsiveFormField = ({ 
  label, 
  required, 
  error, 
  children,
  className = ''
}) => {
  return (
    <div className={`space-y-1.5 sm:space-y-2 ${className}`}>
      {label && (
        <label className="text-xs sm:text-sm font-medium text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      {children}
      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
};

/**
 * ResponsiveButton - زر متجاوب
 */
export const ResponsiveButton = ({ 
  children, 
  fullWidth = false,
  size = 'md',
  ...props 
}) => {
  const sizeMap = {
    'sm': 'px-3 py-1.5 text-sm',
    'md': 'px-4 sm:px-6 py-2 text-sm sm:text-base',
    'lg': 'px-6 sm:px-8 py-2.5 sm:py-3 text-base sm:text-lg'
  };

  const widthClass = fullWidth ? 'w-full' : 'w-full sm:w-auto';

  return (
    <button 
      className={`apple-button ${sizeMap[size]} ${widthClass}`}
      {...props}
    >
      {children}
    </button>
  );
};

/**
 * ResponsiveHeader - عنوان صفحة متجاوب
 */
export const ResponsiveHeader = ({ 
  title, 
  subtitle, 
  onBack,
  actions,
  className = ''
}) => {
  return (
    <div className={`mb-6 sm:mb-8 pt-4 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          {onBack && (
            <button 
              onClick={onBack} 
              className="p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
          )}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{title}</h1>
            {subtitle && <p className="text-sm sm:text-base text-gray-500 mt-1">{subtitle}</p>}
          </div>
        </div>
        {actions && (
          <div className="flex gap-2 sm:gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export default {
  ResponsiveGrid,
  ResponsiveCard,
  ResponsiveStack,
  ResponsiveContainer,
  ResponsiveFormField,
  ResponsiveButton,
  ResponsiveHeader
};
