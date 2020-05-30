function rfw_update() {
    const XHR = new XMLHttpRequest();
    XHR.addEventListener("load", function(event) {
        let response = JSON.parse(event.target.responseText);
        if (response.result) {
            let rfw = document.querySelector('#rfw'),
                subtitle = document.querySelector('.card-subtitle');
            if (response.status['rfw_on'] === 1) {
                rfw.classList.remove('red', 'green', 'orange');
                rfw.classList.add('yellow');
                subtitle.innerText = 'Turning On';
            } else if (response.status['rfw_off'] === 1) {
                rfw.classList.remove('red', 'green', 'yellow');
                rfw.classList.add('orange');
                subtitle.innerText = 'Turning Off';
            } else if (response.rfw === 0) {
                rfw.classList.remove('red', 'orange', 'yellow');
                rfw.classList.add('green');
                subtitle.innerText = '';
            } else {
                rfw.classList.remove('green', 'orange', 'yellow');
                rfw.classList.add('red');    
                subtitle.innerText = '';            
            };
        } else alert('Error: ' + response.error);
    });
    XHR.addEventListener("error", function(event) {
        alert('Oops! Something went wrong.');
    });
    XHR.open('GET', '/status');
    XHR.send(null);
};
function battery_update() {
    const XHR = new XMLHttpRequest();
    XHR.addEventListener("load", function(event) {
        let response = JSON.parse(event.target.responseText);
        if (response.result) {
            let aux  = document.querySelector('#aux'),
                main = document.querySelector('#main');
            aux.innerText  = response.batteries.aux
            main.innerText = response.batteries.main            
        } else {
            alert('Error: ' + response.error);
        };
    });
    XHR.addEventListener("error", function(event) {
        alert('Oops! Something went wrong.');
    });
    XHR.open('GET', '/batteries');
    XHR.send(null);
};