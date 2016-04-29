
// Constants
var startText = "Start"
var resetText = "Reset"

// State
var recipes =
    { "ap-gold-2015":
        { "title": "AeroPress Gold 2015"
        , "times":
            { "stir": 15
            , "bloom": 30
            , "pour": 10
            , "wait": 0
            , "press": 45
            }
        , "steps": []
        , "meta":
            { "inverted": true
            , "ratio": 21
            }
        }

    , "ap-silver-2015":
        { "title": "AeroPress Silver 2015"
        , "times":
            { "stir": 10
            , "bloom": 25
            , "pour": 20
            , "wait": 0
            , "press": 60
            }
        , "steps": []
        , "meta":
            { "inverted": false
            , "ratio": 15
            }
        }

    , "ap-long-brew":
        { "title": "AeroPress Long-brew"
        , "times":
            { "stir": 0
            , "bloom": 4 * 60
            , "pour": 0
            , "wait": 10 * 60
            , "press": 0
            }
        , "steps": []
        , "meta":
            { "inverted": true
            , "grind": "medium-coarse"
            , "ratio": 14
            }
        }

    , "test":
        { "title": "Testing"
        , "times":
            { "stir": 3
            , "bloom": 0
            , "pour": 0
            , "wait": 3
            , "press": 3
            }
        }
    }

var options =
    { "manual": false
    , "beep": true
    }

// timeLoop :: Interval
var timeLoop

// currentRecipe :: String
var currentRecipe


// Data

function TimeState(n, m) {
    this.type = n
    this.value = m
}

var Unchanged = function(m) { return new TimeState(0, m) }
var Decreased = function(m) { return new TimeState(1, m) }
var Shifted = function(m) { return new TimeState(2, m) }

function isShifted(d) {
    return d.type === 2
}

function isUnchanged(d) {
    return d.type === 0
}

function fromTimeState(d) {
    return d.value
}


// Utils

function id(x) { return x }

function const_(x) { return function(y) { return x } }


// createTimes :: Void
function createTimes() {
    var timesWrapper = document.querySelector("nav > section")
    var times = recipes[currentRecipe].times

    for (var timeKey in times) {
        var time = times[timeKey]

        var timeElem = document.createElement("time")
        timeElem.dataset.key = timeKey
        timeElem.textContent = time

        var timeProgressElem = document.createElement("span")

        if (time === 0) timeElem.classList.add("hidden")

        timeElem.appendChild(timeProgressElem)
        timesWrapper.appendChild(timeElem)
    }
}

// modifyTimes :: IO [Element] -> IO a
function modifyTimes(f) {
    var timeElems = document.querySelectorAll("nav time")

    return f(timeElems)
}

// getTimes :: IO [Element]
function getTimes() { return modifyTimes(id) }

// resetTimes :: [Element] -> Void
function resetTimes(timeElems) {
    var times = recipes[currentRecipe].times

    for (var i = 0, l = timeElems.length; i < l; i++) {
        var timeElem = timeElems[i]

        var timeKey = timeElem.dataset.key
        timeElem.childNodes[0].nodeValue = times[timeKey]

        if (times[timeKey] === 0) timeElem.classList.add("hidden")
        else timeElem.classList.remove("hidden")
    }
}

// FIXME zero skips send no Shifted therefore actual index = (i - 1)
// decreaseTime :: [Element] -> IO Decreased
function decreaseTimes(timeElems) {
    var decreased = Unchanged(0)

    for (var i = 0, l = timeElems.length; i < l; i++) {
        var time = parseInt(timeElems[i].textContent)

        if (isShifted(decreased)) {
            decreased = Shifted(i)

            if (time === 0) continue
            else break

        } else if (time === 0) {
            decreased = Unchanged(i)
            continue

        } else {
            timeElems[i].childNodes[0].nodeValue = time - 1

            if (time - 1 === 0) {
                decreased = Shifted(i)
                continue

            } else {
                decreased = Decreased(i)
                break
            }
        }
    }

    return decreased
}

// TODO leverage adding more options live
// createOptions :: Element -> Void
function createOptions(selectElem) {
    // TODO delet chilren
    // OR make a modifyOptions

    var index = i = 0

    for (var recipeKey in recipes) {
        var recipe = recipes[recipeKey]

        var recipeElem = document.createElement("option")
        recipeElem.textContent = recipe.title
        recipeElem.value = recipeKey
        selectElem.appendChild(recipeElem)

        if (recipeKey === getSetting("currentRecipe")) {
            index = i
        }

        i++
    }

    selectElem.selectedIndex = index
}

// XXX not safe
// selectedMethod :: Element -> IO String
function selectedMethod(selectElem) {
    return selectElem.options[selectElem.selectedIndex].value
}

// progressBarTimes :: Number -> ([Element] -> Void)
function progressBar(index) { return function(timeElems) {
    console.log(index)
    var time = recipes[currentRecipe].times[timeElems[index].dataset.key]
    var transText = "width " + time + "s linear"
    timeElems[index].children[0].style.transition = transText
    timeElems[index].children[0].style.width = "100%"
}}

function resetProgressBars(timeElems) {
    for (var i = 0, l = timeElems.length; i < l; i++) {
        timeElems[i].children[0].style.transition = "width 1s linear"
        timeElems[i].children[0].style.width = "0%"
    }
}

// countDownState :: Event -> Void
function countDownState(e) {
    if (this.value !== resetText) {
        this.value = resetText
        modifyTimes(progressBar(0))

        timeLoop = setInterval(function() {
            var decreased = modifyTimes(decreaseTimes)

            if (isUnchanged(decreased)) clearInterval(timeLoop)

            else if (isShifted(decreased)) {
                console.log(decreased)
                playSound()

                modifyTimes(progressBar(fromTimeState(decreased)))
            }

        }, 1000)

    } else {
        resetCountDown(this)
    }
}

// resetCountDown :: Element -> Void
function resetCountDown(startButton) {
    clearInterval(timeLoop)
    modifyTimes(resetTimes)
    modifyTimes(resetProgressBars)
    startButton.value = startText
}

// changeRecipe :: Event -> Void
function changeRecipe(e) {
    currentRecipe = this.value

    setSetting("currentRecipe", currentRecipe)

    var startButton = document.querySelector("nav > aside > input")
    resetCountDown(startButton)
}

// modifySetting :: String -> (a -> b) -> b -> b
function modifySetting(key, f, defaultValue) {
    try {
        defaultValue = f(JSON.parse(localStorage[key]))
    } catch(e) {}

    localStorage[key] = JSON.stringify(defaultValue)

    return defaultValue
}

// setSetting :: String -> a -> Void
function setSetting(key, val) { modifySetting(key, const_(val)) }

// getSetting :: String -> b -> b
function getSetting(key, defaultValue) {
    return modifySetting(key, id, defaultValue)
}

// createMetas :: Void
function createMetas() {
    var meta = recipes[currentRecipe].meta
    var metaWrapper = document.querySelector("summary")

    for (var metaKey in meta) {
        var metaElem = document.createElement("span")
        metaElem.dataset.meta = metaKey
        metaElem.textContent = meta[metaKey]

        metaWrapper.appendChild(metaElem)
    }
}

// playSound :: Void
function playSound() {
    var audio = document.querySelector("audio")

    audio.play()
}


function main() {
    var selectElem = document.querySelector("header > select")
    createOptions(selectElem)

    selectElem.addEventListener("change", changeRecipe)

    currentRecipe = getSetting("currentRecipe", selectedMethod(selectElem))

    createTimes()

    createMetas()

    var startButton = document.querySelector("nav > aside > input")
    startButton.addEventListener("click", countDownState)
}

