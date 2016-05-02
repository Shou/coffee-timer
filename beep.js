
var timeouts = []

onmessage = function(e) {
    if (e.data) {
        e.data.forEach(function(time) {
            timeouts.push(setTimeout(function() {
                postMessage("BEEP NOW")
            }, time * 1000))
        })

    } else {
        timeouts.forEach(clearTimeout)
        timeouts = []
    }
}

