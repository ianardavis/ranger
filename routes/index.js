const i2c  = require('i2c-bus'),
      ADC  = require('ads1115'),
      gpio = require('raspi-gpio');
module.exports = (app, m) => {
    let i2c_outs = [];
    let inputs = {}, circuits = {}, settings = {}, user_on = [], handled = [], ih = {};
    
    function destroy (table, where, nullOK = false) {
        return new Promise((resolve, reject) => {
            table.destroy(
                {where: where}
            )
            .then(result => {
                if (result)      resolve(true);
                else if (nullOK) resolve(false)
                else             reject(new Error('NOT deleted',));
            })
            .catch(err => reject(err));
        });
    };
    function create (table, record) {
        return new Promise((resolve, reject) => {
            table.create(record)
            .then(created => resolve(created))
            .catch(err => {
                console.log(err);
                if (err.parent && err.parent.code === 'ER_DUP_ENTRY') reject(new Error(err.parent.sqlMessage));
                else reject(err);
            });
        });
    };
    function getOne (table, where, options = {}) {
        return new Promise((resolve, reject) => {
            table.findOne({where: where})
            .then(result => {
                if (result) resolve(result);
                else if (options.nullOK) resolve(null)
                else reject(new Error('Not found'));
            })
            .catch(err => reject(err));
        });
    };
    function getAll (table, include = []) {
        return new Promise((resolve, reject) => {
            table.findAll({include: include})
            .then(results => resolve(results))
            .catch(err => reject(err));
        });
    };
    function update (table, record, where) {
        return new Promise((resolve, reject) => {
            table.update(
                record,
                {where: where}
            )
            .then(result => {
                if (result) resolve(true)
                else        reject('NOT updated');
            })
            .catch(err => reject(err));
        });
    };

    function switch_circuit(circuit, byte) {
        try {
            let i2c_bus = i2c.openSync(1);
            i2c_bus.writeByteSync(circuits[circuit].address, 0, byte + circuits[circuit].relay);
            return {result: true};
        } catch (error) {
            console.log(error);
            return {result: false, error: error};
        };
    };
    function read_i2c () {
        return new Promise((resolve, reject) => {
            try {
                let circuit_states = {},
                    i2c_bus = i2c.openSync(1),
                    buses = {};
                i2c_outs.forEach(address => {
                    buses['addr-' + address.toString(10)] = i2c_bus.readByteSync(address, 1).toString(2).padStart(8, '0').split("").reverse();
                });
                for (let [circuit, details] of Object.entries(circuits)) {
                    circuit_states[circuit] = Number(buses['addr-' + String(details.address)][details.relay - 1]);
                };
                resolve(circuit_states);
            } catch (error) {
                console.log(error);
                reject(0);
            };
        });
        
    };
    function read_volts() {
        return new Promise(resolve => {
            i2c.openPromisified(1).then(async (bus) => {
                const adc = await ADC(bus);
                let values = {main: [], aux: []}, value2 = 0, value3 = 0, count2 = 0, count3 = 0;
                for (let i = 0; i < 10; i++) {
                    let v2 = await adc.measure('2+GND'),
                        v3 = await adc.measure('3+GND')
                    if (v2 < 27000) {
                        value2 += v2;
                        count2 += 1;
                        values.main.push(v2)
                    };
                    if (v3 < 27000) {
                        value3 += v3;
                        count3 += 1;
                        values.aux.push(v3)
                    };
                };

                resolve({main: ((value2 / count2) / 952).toFixed(1), aux: ((value3 / count3) / 952).toFixed(1)});
            })
            
        })      
    };
    function all_off() {
        let results = {result: true};
        i2c_outs.forEach(address => {
            let i2c_bus = i2c.openSync(1);
            i2c_bus.writeByteSync(address, 0, 110);
        });
        return results;
    };
    ih.reverse = () => {
        check_rearspots();
        check_camera();
        handled.splice(handled.indexOf('reverse'), 1);
    };
    ih.lights = () => {
        check_rearspots();
        handled.splice(handled.indexOf('lights'), 1);
    };
    function check_rearspots() {
        if (user_on.indexOf('rearspots') !== -1) {
            switch_circuit('rearspots', 100); //On
        } else if (settings['rearspots_reverse'] === 1) {
            if (inputs['reverse'].value === 0) {
                if (settings['rearspots_lights'] === 1) {
                    if (inputs['lights'].value === 0) {
                        switch_circuit('rearspots', 100); //On
                    } else {
                        switch_circuit('rearspots', 110); //Off
                    };
                } else {
                    switch_circuit('rearspots', 100); //On
                };
            } else {
                switch_circuit('rearspots', 110); //Off
            };
        } else {
            switch_circuit('rearspots', 110); //Off
        };
    };
    function check_camera () {
        if (user_on.indexOf('camera_reverse') !== -1) {
            switch_circuit('camera_reverse', 100); //On
        } else if (settings['camera_reverse'] === 1) {
            if (inputs['reverse'].value === 0) {
                switch_circuit('camera_reverse', 100); //On
            } else {
                switch_circuit('camera_reverse', 110); //Off
            };
        } else {
            switch_circuit('camera_reverse', 110); //Off
        };
    };
    ih.highbeam = () => {
        if (user_on.indexOf('frontspots') !== -1) {
            switch_circuit('frontspots', 100); //On
        } else if (settings['frontspots_highbeam'] === 1) {
            if (inputs['highbeam'].value === 0) {
                switch_circuit('frontspots', 100); //On
            } else {
                switch_circuit('frontspots', 110); //Off
            };
        } else {
            switch_circuit('frontspots', 110); //Off
        };
        handled.splice(handled.indexOf('highbeam'), 1);
    };
    ih.hazards = () => {
        if (user_on.indexOf('strobes') !== -1) {
            switch_circuit('strobes', 100); //On
        } else if (settings['strobes_hazards'] === 1) {
            if (inputs['hazards'].value === 0) {
                switch_circuit('strobes', 100); //On
            } else {
                switch_circuit('strobes', 110); //Off
            };
        } else {
            switch_circuit('strobes', 110); //Off
        };
        handled.splice(handled.indexOf('hazards'), 1);
    };
    ih.fourXfour = () => {
        check_rfw();
        handled.splice(handled.indexOf('fourXfour'), 1);
    };
    ih.rfw = () => {
        check_rfw();
        handled.splice(handled.indexOf('rfw'), 1);
    };
    function check_rfw() {
        if (user_on.indexOf('rfw') !== -1) {
            rfw_on();
        } else {
            if (settings['rfw_4x4'] === 1) {
                if (settings['rfw_auto_off'] === 1) {
                    if (inputs['fourXfour'].value === 0) {
                        rfw_on();
                    } else {
                        rfw_off();
                    };
                } else {
                    if (inputs['fourXfour'].value === 0) {
                        rfw_on();
                    };
                };
            };
        };
    };
    function rfw_on() {
        switch_circuit('rfw_off', 110) //Off
        read_i2c()
        .then(circuit_states => {
            if (inputs['rfw'].value === 1) {
                if (circuit_states['rfw_on'] === 0) {
                    switch_circuit('rfw_on', 100); //On
                } else {
                    switch_circuit('rfw_on', 110); //Off
                };
            } if (circuit_states['rfw_on'] === 1) {
                switch_circuit('rfw_on', 110); //Off
            };
        })
        .catch(err => console.log(err));
    };
    function rfw_off() {
        switch_circuit('rfw_on', 110) //Off
        read_i2c()
        .then(circuit_states => {
            if (inputs['rfw'].value === 0) {
                if (circuit_states['rfw_off'] === 0) {
                    switch_circuit('rfw_off', 100); //On
                } else {
                    switch_circuit('rfw_off', 110); //Off
                };
            } if (circuit_states['rfw_off'] === 1) {
                switch_circuit('rfw_off', 110); //Off
            };
        })
        .catch(err => console.log(err));
    };
    function setup_gpio() {
        console.log('Setting up GPIO inputs');
        return new Promise((resolve, reject) => {
            getAll(m.gpio)
            .then(gpios => {
                gpios.forEach(input => {
                    inputs[input._circuit] = new gpio.DigitalInput({
                        pin: 'GPIO' + input._pin,
                        pullResistor: gpio.PULL_UP
                    });
                    inputs[input._circuit].on('change',function(){
                        if (handled.indexOf(input) === -1) {
                            handled.push(input);
                            setTimeout(() => {ih[input._circuit]()}, 50);
                        };
                    });
                });
                resolve(true);
            })
            .catch(err => {
                reject(err);
            });
        });
    };
    function get_circuits() {
        return new Promise((resolve, reject) => {
            getAll(m.circuits)
            .then(circuits => {
                let _circuits = {}, addresses = [];
                circuits.forEach(circuit => {
                    if (addresses.indexOf(parseInt(circuit._address)) === -1) addresses.push(parseInt(circuit._address));
                    _circuits[circuit._name] = {address: parseInt(circuit._address), relay: circuit._relay}
                })
                resolve({circuits: _circuits, addresses: addresses})
            })
            .catch(err => {
                console.log(err);
                reject(err);
            });
        });
    };
    function send_error(err, res) {
        console.log(err);
        res.send({result: false, error: err});        
    };
    function getSettings() {
        return new Promise((resolve, reject) => {
            getAll(m.settings)
            .then(settings => {
                let _settings = {};
                settings.forEach(setting => {
                    _settings[setting._name] = setting._value;
                });
                resolve(_settings);
            })
            .catch(err => reject(err));
        });
    };
    function update_setting(setting, value) {
        return new Promise((resolve, reject) => {
            update(
                m.settings,
                {_value: value},
                {_name: setting}
            )
            .then(result => {
                getSettings()
                .then(_settings => {
                    settings = _settings;
                    resolve(true);
                })
                .catch(err => {
                    console.log(err);
                    reject(err);
                });
            })
            .catch(err => reject(err));
        });
    };

    setup_gpio()
    .then(result => {
        get_circuits()
        .then(results => {
            circuits = results.circuits;
            i2c_outs = results.addresses;
            all_off();
            switch_circuit('camera_rear', 100);
            getSettings()
            .then(_settings => {
                settings = _settings;
                app.get('/',                 (req, res) => res.render('index'));
                app.get('/status',           (req, res) => {
                    read_i2c()
                    .then(circuit_states => res.send({result:true, status: circuit_states, settings: settings, rfw: inputs['rfw'].value}))
                    .catch(err => res.send({result:true, status: {}, settings: settings}))
                });
                app.get('/batteries',        (req, res) => {
                    read_volts()
                    .then(values => {
                        res.send({result:true, batteries: values})
                    })
                    .catch(err => {
                        console.log('error: ', err);
                        res.send({result: false, error: err});
                    });
                })
                app.get('/lights',           (req, res) => res.render('lights'));
                app.get('/body',             (req, res) => res.render('body'));
                app.get('/settings',         (req, res) => res.render('settings'));
                app.post('/toggle/:circuit', (req, res) => {
                    if (req.params.circuit === 'all_off') {
                        res.send(all_off())
                    } else {
                        read_i2c()
                        .then(circuit_states => {
                            if (req.params.circuit === 'rfw') {
                                if (circuit_states['rfw_on'] === 1) {
                                    if (user_on.indexOf('rfw') !== -1) user_on.splice(user_on.indexOf('rfw'), 1);
                                    rfw_off();
                                } else if (circuit_states['rfw_off'] === 1) {
                                    if (user_on.indexOf('rfw') === -1) user_on.push('rfw');
                                    rfw_on();
                                } else if (inputs['rfw'].value === 1) {
                                    if (user_on.indexOf('rfw') === -1) user_on.push('rfw');
                                    rfw_on();
                                } else {
                                    if (user_on.indexOf('rfw') !== -1) user_on.splice(user_on.indexOf('rfw'), 1);
                                    rfw_off();
                                }
                                res.send({result: true});
                            } else {
                                let byte = 0;
                                if (circuit_states[req.params.circuit] === 0) {
                                    if (user_on.indexOf(req.params.circuit) === -1) user_on.push(req.params.circuit);
                                    byte += 100;
                                } else {
                                    if (user_on.indexOf(req.params.circuit) !== -1) user_on.splice(user_on.indexOf(req.params.circuit), 1);
                                    byte += 110;
                                };
                                let result = switch_circuit(
                                    req.params.circuit,
                                    byte
                                );
                                res.send(result);
                            };
                        })
                        .catch(err => send_error(err, res))
                    };
                });
                app.post('/setting/:setting', (req, res) => {
                    getOne(
                        m.settings,
                        {_name: req.params.setting}
                    )
                    .then(setting => {
                        if (setting._value === 0) {
                            update_setting(setting._name, 1)
                            .then(result => res.send({result: true}))
                            .catch(err => send_error(err, res));
                        } else {
                            update_setting(setting._name, 0)
                            .then(result => res.send({result: true}))
                            .catch(err => send_error(err, res));
                        };
                    })
                    .catch(err => send_error(err, res));
                });
                app.get('*',                 (req, res) => res.render('404'));
            })
            .catch(err => {
                app.get('*', (req, res) => res.render('404'));
                console.log(err)
            });
        })
        .catch(err => {
            app.get('*', (req, res) => res.render('404'));
            console.log(err)
        });
    })
    .catch(err => {
        app.get('*', (req, res) => res.render('404'));
        console.log(err)
    });
};