import { NativeModule, requireNativeModule } from 'expo';

declare class VaultsyncNativeModule extends NativeModule<{}> {}

export default requireNativeModule<VaultsyncNativeModule>('VaultsyncNative');
