// Jest shim — wired via jest.config.js moduleNameMapper.
// On device the app uses the native react-native-libsodium (JSI). That native
// module can't load under Node, so in tests we back the identical libsodium API
// with libsodium-wrappers-sumo (its WASM build runs fine under Node). Same
// libsodium underneath, so crypto in tests is byte-identical to the device.
import sodium from 'libsodium-wrappers-sumo';

export default sodium;
