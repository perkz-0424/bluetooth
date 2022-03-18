const {
  ab2hex,
  inArray
} = require ("../common/utils");

Page ({
  data: {
    devices: [],
    connected: false,
    chs: [],
    search: false,
  },

  onShow () {
    this.openBluetoothAdapter ();
  },

  onUnload () {
    this.closeBluetoothAdapter ();
  },

  // 打开蓝牙
  openBluetooth () {
    wx.openBluetoothAdapter ({
      success: () => {
        this.startBluetoothDevicesDiscovery ();
      },
      fail: (res) => {
        if (res.errCode === 10001) {
          wx.onBluetoothAdapterStateChange (function (res) {
            if (res.available) {
              this.startBluetoothDevicesDiscovery ();
            }
          });
        }
      }
    });
  },
  // 关闭原有的蓝牙后重新开启
  openBluetoothAdapter () {
    this.closeBluetoothAdapter ()
      .then (this.openBluetooth)
      .catch (this.openBluetooth);
  },

  // 开启蓝牙
  getBluetoothAdapterState () {
    wx.getBluetoothAdapterState ({
      success: (res) => {
        if (res.discovering) {
          this.onBluetoothDeviceFound ();
        } else if (res.available) {
          this.startBluetoothDevicesDiscovery ();
        }
      }
    });
  },
  // 开始搜索蓝牙设备
  startBluetoothDevicesDiscovery () {
    if (this._discoveryStarted) {
      return;
    }
    this._discoveryStarted = true;
    wx.startBluetoothDevicesDiscovery ({
      allowDuplicatesKey: true,
      success: () => {
        this.onBluetoothDeviceFound ();
      },
    });
  },

  // 结束搜索蓝牙设备
  stopBluetoothDevicesDiscovery () {
    this.setData ({
      search: false
    });
    wx.stopBluetoothDevicesDiscovery ();
  },

  // 解析蓝牙设备
  onBluetoothDeviceFound () {
    this.setData ({
      search: true
    });
    wx.onBluetoothDeviceFound ((res) => {
      res.devices.forEach (device => {
        if (!device.name && !device.localName) {
          return;
        }
        const foundDevices = this.data.devices;
        const idx = inArray (foundDevices, "deviceId", device.deviceId);
        const data = {};
        if (idx === -1) {
          data[`devices[${foundDevices.length}]`] = device;
        } else {
          data[`devices[${idx}]`] = device;
        }
        this.setData (data);
      });
    });
  },

  // 与蓝牙设备连接
  createBLEConnection (e) {
    this.closeBLEConnection ();
    const ds = e.currentTarget.dataset;
    const deviceId = ds.deviceId;
    const name = ds.name;
    wx.createBLEConnection ({
      deviceId,
      success: (res) => {
        this.setData ({
          connected: true,
          name,
          deviceId,
        });
        this.getBLEDeviceServices (deviceId);
      }
    });
    this.stopBluetoothDevicesDiscovery ();
  },
  // 与蓝牙设备断开
  closeBLEConnection () {
    wx.closeBLEConnection ({
      deviceId: this.data.deviceId
    });
    this.setData ({
      connected: false,
      chs: [],
      canWrite: false,
    });
  },
  // 接连蓝牙
  getBLEDeviceServices (deviceId) {
    wx.getBLEDeviceServices ({
      deviceId,
      success: (res) => {
        for (let i = 0; i < res.services.length; i++) {
          if (res.services[i].isPrimary) {
            this.getBLEDeviceCharacteristics (deviceId, res.services[i].uuid);
            return;
          }
        }
      }
    });
  },
  // 设备和蓝牙对接
  getBLEDeviceCharacteristics (deviceId, serviceId) {
    // 先监获取数据
    wx.onBLECharacteristicValueChange ((characteristic) => {
      console.log(characteristic)
      // const idx = inArray (this.data.chs, "uuid", characteristic.characteristicId);
      // const data = {};
      // if (idx === -1) {
      //   data[`chs[${this.data.chs.length}]`] = {
      //     uuid: characteristic.characteristicId,
      //     value: ab2hex (characteristic.value)
      //   };
      // } else {
      //   data[`chs[${idx}]`] = {
      //     uuid: characteristic.characteristicId,
      //     value: ab2hex (characteristic.value)
      //   };
      // }
      // console.log(data)
      // this.setData (data);
    });

    wx.getBLEDeviceCharacteristics ({
      deviceId,
      serviceId,
      success: (res) => {
        for (let i = 0; i < res.characteristics.length; i++) {
          let item = res.characteristics[i];
          if (item.properties.read) {
            wx.readBLECharacteristicValue ({
              deviceId,
              serviceId,
              characteristicId: item.uuid,
            });
          }
          if (item.properties.write) {
            this.setData ({
              canWrite: true
            });
            this._deviceId = deviceId;
            this._serviceId = serviceId;
            this._characteristicId = item.uuid;
            this.writeBLECharacteristicValue (deviceId, serviceId, item.uuid);
          }
          if (item.properties.notify || item.properties.indicate) {
            wx.notifyBLECharacteristicValueChange ({
              deviceId,
              serviceId,
              characteristicId: item.uuid,
              state: true,
            });
          }
        }
      },
      fail (res) {
        console.error ("getBLEDeviceCharacteristics", res);
      }
    });
  },
  writeBLECharacteristicValue (deviceId, serviceId, characteristicId) {
    let buffer = new ArrayBuffer (1);
    let dataView = new DataView (buffer);
    dataView.setUint8 (0, Math.random () * 255 | 0);
    wx.writeBLECharacteristicValue ({
      deviceId,
      serviceId,
      characteristicId,
      value: buffer,
      success: function () {
        console.log ("写入成功");
      },
      fail: function (res) {
        console.log ("写入失败");
      }
    });
  },
  // 关闭
  closeBluetoothAdapter () {
    this.stopBluetoothDevicesDiscovery ();
    this._discoveryStarted = false;
    return wx.closeBluetoothAdapter ();
  },
});
