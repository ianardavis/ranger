var express  = require('express'),
    app      = express();
function portInUseCheck () {
    return new Promise((resolve, reject) => {
        console.log('Checking port 3000 is available');
        const execSync = require('child_process').execSync;
        try {
            const output = execSync('ss -tnlp | grep :3000', { encoding: 'utf-8' });
            let pid = output.substring(output.indexOf('pid=') + 4, output.indexOf(',', output.search('pid=')));
            console.log('   In use by PID ' +  pid);
            try {
                const kill_output = execSync('kill -9 ' + pid, { encoding: 'utf-8' });
                resolve('   PID killed');
            } catch (error) {
                reject(error);
            };
        } catch (error) {
            if (error.output[0]) {
                reject(error);
            } else {
                resolve('   Not in use');
            };
        };
    });
};

portInUseCheck()
.then(result => {
    if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development';
    console.log('Environment: ' + process.env.NODE_ENV);
    process.env.ROOT = __dirname;

    app.set('view engine', 'ejs');
    app.use(express.static(__dirname + '/public'));
    let m  = require('./db/models')
    require('./routes')(app, m);
    app.listen(3000, err => {
        if (err) console.log(err);
        else {
            console.log('Server listening on port 3000');
            // const output = execSync('chromium-browser --start-fullscreen localhost:3000', { encoding: 'utf-8' });
            // console.log(output);
        };
    });
})
.catch(err => {
    console.log(err);
});