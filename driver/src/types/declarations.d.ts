declare module '*.css';
declare module '*.png' {
  const value: any;
  export default value;
}
declare module '*.jpg' {
  const value: any;
  export default value;
}
declare module '*.svg' {
  const value: any;
  export default value;
}

declare module '@react-native-async-storage/async-storage' {
  const AsyncStorage: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
    removeItem: (key: string) => Promise<void>;
    clear: () => Promise<void>;
  };
  export default AsyncStorage;
}

declare module 'expo-task-manager' {
  export function defineTask(taskName: string, taskExecutor: (body: any) => Promise<void> | void): void;
  export function isTaskDefined(taskName: string): boolean;
}
