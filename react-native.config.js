// Excluye react-native-bluetooth-classic del build de iOS.
// En iPhone esa libreria crashea al abrir (RNBluetoothClassic.init) y el
// Bluetooth clasico/SPP no esta disponible. Android no cambia.
module.exports = {
  dependencies: {
    'react-native-bluetooth-classic': {
      platforms: { ios: null },
    },
  },
};
