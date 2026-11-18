import { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    process.env.EAS_PROJECT_ID ||
    config.extra?.eas?.projectId;
  if (
    projectId &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)
  ) {
    throw new Error('EXPO_PUBLIC_EAS_PROJECT_ID must be the UUID of your free Expo project.');
  }
  return {
    ...config,
    name: config.name ?? 'Участки',
    slug: config.slug ?? 'uchastki',
    owner: process.env.EXPO_OWNER || config.owner,
    // Bump app.json version whenever native dependencies or permissions change.
    runtimeVersion: { policy: 'appVersion' },
    updates: projectId
      ? {
          enabled: true,
          url: `https://u.expo.dev/${projectId}`,
          checkAutomatically: 'ON_LOAD',
          fallbackToCacheTimeout: 0,
          requestHeaders: { 'expo-channel-name': 'production' },
        }
      : { enabled: false },
    extra: { ...config.extra, ...(projectId ? { eas: { projectId } } : {}) },
  };
};
