import { DefaultTheme } from 'react-native-paper';

export const colors = {
  primary: '#1C77FF',
  secondary: '#27AE60',
  background: '#FFFFFF',
  surface: '#F8F9FA',
  text: '#2C3E50',
  textSecondary: '#7F8C8D',
  border: '#E1E8ED',
  error: '#E74C3C',
  warning: '#F39C12',
  success: '#27AE60',
  info: '#3498DB',
  
  // Status colors
  pending: '#F39C12',
  inProgress: '#3498DB',
  completed: '#27AE60',
  cancelled: '#E74C3C',
  
  // Role colors
  director: '#8E44AD',
  manager: '#2980B9',
  supervisor: '#16A085',
  measurer: '#F39C12',
  delivery: '#E67E22',
  installer: '#27AE60',
  client: '#34495E',
  
  // Gradients
  primaryGradient: ['#1C77FF', '#4A90E2'],
  secondaryGradient: ['#27AE60', '#2ECC71'],
  
  // Shadows
  shadow: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  
  // Card shadows
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.08,
    shadowRadius: 2.22,
    elevation: 3,
  }
};

export const typography = {
  fontFamily: {
    regular: 'Inter-Regular',
    medium: 'Inter-Medium',
    semiBold: 'Inter-SemiBold',
    bold: 'Inter-Bold',
  },
  
  sizes: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
  },
  
  lineHeights: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  }
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
};

export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    accent: colors.secondary,
    background: colors.background,
    surface: colors.surface,
    text: colors.text,
    placeholder: colors.textSecondary,
    backdrop: 'rgba(0, 0, 0, 0.5)',
    notification: colors.error,
  },
  fonts: {
    regular: {
      fontFamily: typography.fontFamily.regular,
      fontWeight: 'normal',
    },
    medium: {
      fontFamily: typography.fontFamily.medium,
      fontWeight: '500',
    },
    light: {
      fontFamily: typography.fontFamily.regular,
      fontWeight: '300',
    },
    thin: {
      fontFamily: typography.fontFamily.regular,
      fontWeight: '100',
    },
  },
  roundness: borderRadius.md,
};

// Component-specific styles
export const componentStyles = {
  button: {
    primary: {
      backgroundColor: colors.primary,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      ...colors.shadow,
    },
    secondary: {
      backgroundColor: colors.secondary,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      ...colors.shadow,
    },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
  },
  
  card: {
    default: {
      backgroundColor: colors.background,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginVertical: spacing.sm,
      ...colors.cardShadow,
    },
    elevated: {
      backgroundColor: colors.background,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginVertical: spacing.sm,
      ...colors.shadow,
    },
  },
  
  input: {
    default: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      fontSize: typography.sizes.base,
      fontFamily: typography.fontFamily.regular,
      color: colors.text,
    },
    focused: {
      borderColor: colors.primary,
      borderWidth: 2,
    },
    error: {
      borderColor: colors.error,
    },
  },
  
  header: {
    default: {
      backgroundColor: colors.primary,
      paddingTop: spacing.xl,
      paddingBottom: spacing.md,
      paddingHorizontal: spacing.md,
    },
  },
  
  statusBadge: {
    pending: {
      backgroundColor: colors.warning,
      color: colors.background,
    },
    inProgress: {
      backgroundColor: colors.info,
      color: colors.background,
    },
    completed: {
      backgroundColor: colors.success,
      color: colors.background,
    },
    cancelled: {
      backgroundColor: colors.error,
      color: colors.background,
    },
  },
  
  roleBadge: {
    director: {
      backgroundColor: colors.director,
      color: colors.background,
    },
    manager: {
      backgroundColor: colors.manager,
      color: colors.background,
    },
    supervisor: {
      backgroundColor: colors.supervisor,
      color: colors.background,
    },
    measurer: {
      backgroundColor: colors.measurer,
      color: colors.background,
    },
    delivery_person: {
      backgroundColor: colors.delivery,
      color: colors.background,
    },
    installer: {
      backgroundColor: colors.installer,
      color: colors.background,
    },
    client: {
      backgroundColor: colors.client,
      color: colors.background,
    },
  },
};

// Utility functions
export const getStatusColor = (status) => {
  const statusMap = {
    pending: colors.warning,
    measuring_scheduled: colors.info,
    measuring_in_progress: colors.info,
    measuring_completed: colors.success,
    production_scheduled: colors.info,
    in_production: colors.info,
    production_completed: colors.success,
    delivery_scheduled: colors.info,
    in_delivery: colors.info,
    delivered: colors.success,
    installation_scheduled: colors.info,
    installation_in_progress: colors.info,
    installation_completed: colors.success,
    completed: colors.success,
    cancelled: colors.error,
    assigned: colors.warning,
    en_route: colors.info,
    arrived: colors.info,
  };
  
  return statusMap[status] || colors.textSecondary;
};

export const getRoleColor = (role) => {
  const roleMap = {
    director: colors.director,
    manager: colors.manager,
    supervisor: colors.supervisor,
    measurer: colors.measurer,
    delivery_person: colors.delivery,
    installer: colors.installer,
    client: colors.client,
  };
  
  return roleMap[role] || colors.textSecondary;
};

export const formatStatusText = (status) => {
  const statusMap = {
    pending: 'Pending',
    measuring_scheduled: 'Measuring Scheduled',
    measuring_in_progress: 'Measuring in Progress',
    measuring_completed: 'Measuring Completed',
    production_scheduled: 'Production Scheduled',
    in_production: 'In Production',
    production_completed: 'Production Completed',
    delivery_scheduled: 'Delivery Scheduled',
    in_delivery: 'In Delivery',
    delivered: 'Delivered',
    installation_scheduled: 'Installation Scheduled',
    installation_in_progress: 'Installation in Progress',
    installation_completed: 'Installation Completed',
    completed: 'Completed',
    cancelled: 'Cancelled',
    assigned: 'Assigned',
    en_route: 'En Route',
    arrived: 'Arrived',
  };
  
  return statusMap[status] || status;
};

export const formatRoleText = (role) => {
  const roleMap = {
    director: 'Director',
    manager: 'Manager',
    supervisor: 'Supervisor',
    measurer: 'Measurer',
    delivery_person: 'Delivery Person',
    installer: 'Installer',
    client: 'Client',
  };
  
  return roleMap[role] || role;
};