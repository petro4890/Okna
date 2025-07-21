import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../theme/theme';
import { useAuth } from '../contexts/AuthContext';

// Import screens
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import OrdersScreen from '../screens/orders/OrdersScreen';
import OrderDetailsScreen from '../screens/orders/OrderDetailsScreen';
import JobsScreen from '../screens/jobs/JobsScreen';
import JobDetailsScreen from '../screens/jobs/JobDetailsScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import AboutScreen from '../screens/about/AboutScreen';
import ContractsScreen from '../screens/contracts/ContractsScreen';
import ContractDetailsScreen from '../screens/contracts/ContractDetailsScreen';
import UsersScreen from '../screens/users/UsersScreen';
import UserDetailsScreen from '../screens/users/UserDetailsScreen';
import CreateOrderScreen from '../screens/orders/CreateOrderScreen';
import CreateJobScreen from '../screens/jobs/CreateJobScreen';
import CRMScreen from '../screens/crm/CRMScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();

// Stack navigators for each tab
const DashboardStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: colors.primary },
      headerTintColor: colors.background,
      headerTitleStyle: { fontFamily: typography.fontFamily.semiBold },
    }}
  >
    <Stack.Screen name="DashboardMain" component={DashboardScreen} options={{ title: 'Dashboard' }} />
    <Stack.Screen name="OrderDetails" component={OrderDetailsScreen} options={{ title: 'Order Details' }} />
    <Stack.Screen name="JobDetails" component={JobDetailsScreen} options={{ title: 'Job Details' }} />
    <Stack.Screen name="ContractDetails" component={ContractDetailsScreen} options={{ title: 'Contract Details' }} />
  </Stack.Navigator>
);

const OrdersStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: colors.primary },
      headerTintColor: colors.background,
      headerTitleStyle: { fontFamily: typography.fontFamily.semiBold },
    }}
  >
    <Stack.Screen name="OrdersList" component={OrdersScreen} options={{ title: 'Orders' }} />
    <Stack.Screen name="OrderDetails" component={OrderDetailsScreen} options={{ title: 'Order Details' }} />
    <Stack.Screen name="CreateOrder" component={CreateOrderScreen} options={{ title: 'Create Order' }} />
  </Stack.Navigator>
);

const JobsStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: colors.primary },
      headerTintColor: colors.background,
      headerTitleStyle: { fontFamily: typography.fontFamily.semiBold },
    }}
  >
    <Stack.Screen name="JobsList" component={JobsScreen} options={{ title: 'Jobs' }} />
    <Stack.Screen name="JobDetails" component={JobDetailsScreen} options={{ title: 'Job Details' }} />
    <Stack.Screen name="CreateJob" component={CreateJobScreen} options={{ title: 'Create Job' }} />
  </Stack.Navigator>
);

const ProfileStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: colors.primary },
      headerTintColor: colors.background,
      headerTitleStyle: { fontFamily: typography.fontFamily.semiBold },
    }}
  >
    <Stack.Screen name="ProfileMain" component={ProfileScreen} options={{ title: 'Profile' }} />
    <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
    <Stack.Screen name="Contracts" component={ContractsScreen} options={{ title: 'Contracts' }} />
    <Stack.Screen name="ContractDetails" component={ContractDetailsScreen} options={{ title: 'Contract Details' }} />
    <Stack.Screen name="About" component={AboutScreen} options={{ title: 'About Us' }} />
  </Stack.Navigator>
);

// Admin-only screens stack
const AdminStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: colors.primary },
      headerTintColor: colors.background,
      headerTitleStyle: { fontFamily: typography.fontFamily.semiBold },
    }}
  >
    <Stack.Screen name="UsersList" component={UsersScreen} options={{ title: 'Users' }} />
    <Stack.Screen name="UserDetails" component={UserDetailsScreen} options={{ title: 'User Details' }} />
    <Stack.Screen name="CRM" component={CRMScreen} options={{ title: 'CRM Integration' }} />
  </Stack.Navigator>
);

// Tab navigator
const TabNavigator = () => {
  const { user, canManageUsers, canViewAllProjects, isWorker, isClient } = useAuth();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          switch (route.name) {
            case 'Dashboard':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Orders':
              iconName = focused ? 'list' : 'list-outline';
              break;
            case 'Jobs':
              iconName = focused ? 'briefcase' : 'briefcase-outline';
              break;
            case 'Admin':
              iconName = focused ? 'settings' : 'settings-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'circle';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          paddingBottom: 5,
          height: 60,
        },
        tabBarLabelStyle: {
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.sizes.xs,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardStack}
        options={{ title: 'Dashboard' }}
      />
      
      {(canViewAllProjects() || isClient()) && (
        <Tab.Screen 
          name="Orders" 
          component={OrdersStack}
          options={{ title: 'Orders' }}
        />
      )}
      
      {(canViewAllProjects() || isWorker()) && (
        <Tab.Screen 
          name="Jobs" 
          component={JobsStack}
          options={{ title: 'Jobs' }}
        />
      )}
      
      {canManageUsers() && (
        <Tab.Screen 
          name="Admin" 
          component={AdminStack}
          options={{ title: 'Admin' }}
        />
      )}
      
      <Tab.Screen 
        name="Profile" 
        component={ProfileStack}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
};

// Main app navigator
const AppNavigator = () => {
  return <TabNavigator />;
};

export default AppNavigator;