function toggle(circuit) {
    const XHR = new XMLHttpRequest();
    XHR.addEventListener("load", function(event) {
        let response = JSON.parse(event.target.responseText);
        if (response.result) console.log('Ok');
        else alert('Error: ' + response.error);
    });
    XHR.addEventListener("error", function(event) {
        alert('Oops! Something went wrong.');
    });
    XHR.open('POST', '/toggle/' + circuit);
    XHR.send(null);
};
function settings(setting) {
    const XHR = new XMLHttpRequest();
    XHR.addEventListener("load", function(event) {
        let response = JSON.parse(event.target.responseText);
        if (response.result) console.log('Ok');
        else alert('Error: ' + response.error);
    });
    XHR.addEventListener("error", function(event) {
        alert('Oops! Something went wrong.');
    });
    XHR.open('POST', '/setting/' + setting);
    XHR.send(null);
};
function status_update() {
    const XHR = new XMLHttpRequest();
    XHR.addEventListener("load", function(event) {
        let response = JSON.parse(event.target.responseText);
        if (response.result) {
            let setting_cards = document.querySelectorAll('.setting');
            setting_cards.forEach(card => {
                if (response.settings[card.id] === 1) {
                    card.classList.remove('red');
                    card.classList.add('green');
                } else {
                    card.classList.remove('green');
                    card.classList.add('red');
                };
            });
            let status_cards = document.querySelectorAll('.update');
            status_cards.forEach(card => {
                if (response.status[card.id] === 1) {
                    card.classList.remove('red');
                    card.classList.add('green');
                } else {
                    card.classList.remove('green');
                    card.classList.add('red');
                };
            });
        } else alert('Error: ' + response.error);
    });
    XHR.addEventListener("error", function(event) {
        alert('Oops! Something went wrong.');
    });
    XHR.open('GET', '/status');
    XHR.send(null);
};