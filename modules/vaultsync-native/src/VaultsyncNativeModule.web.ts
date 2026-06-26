import { registerWebModule, NativeModule } from 'expo';

// VaultsyncNativeModule is not available on the web platform.
class VaultsyncNativeModule extends NativeModule<{}> {}

export default registerWebModule(VaultsyncNativeModule, 'VaultsyncNativeModule');
