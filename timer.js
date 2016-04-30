
// Constants
var startText = "Start"
var resetText = "Reset"

// State

// {{{ Recipes
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
// }}}

var options =
    { "manual": false
    , "beep": true
    }

// timeLoop :: Interval
var timeLoop

// currentRecipe :: String
var currentRecipe


// Utils

// | Get POSIX time in seconds
// getPOSIXTime :: IO Integer
var getPOSIXTime = function() { return Date.now() / 1000 | 0 }


// Program

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

// setTimes :: [Number] -> Void
var setTimes = R.compose(modifyTimes, R.zipWith(function(t, e) {
        e.childNodes[0].nodeValue = t
}))

// setProgressBars :: [Number] -> [Number] -> Void
var setProgressBars = function(recipeTimes, reducedTimes) {
        R.compose(modifyTimes, R.zipWith(function(ts, e) {
            var width = 100 - (ts[1] / ts[0] * 100)
            e.children[0].style.width = width + "%"
        }), R.zipWith(R.pair, recipeTimes))(reducedTimes)
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

// TODO resume countdown; android
// countDownState :: Event -> Void
function countDownState(e) {
    if (this.value !== resetText) {
        this.value = resetText

        var recipeTimes = recipes[currentRecipe].times
        var currentTimes = recipeTimes
        var startTime = getPOSIXTime()
        var goalTime = startTime + R.sum(R.values(currentTimes))
        var timeDiff = goalTime - startTime

        timeLoop = setInterval(function() {
            var elapsedTime = timeDiff - (goalTime - getPOSIXTime())
            // reducedTimes :: [Number]
            var reducedTimes = R.nth(1, R.mapAccum(
                    function(acc, x) {
                        return R.map(R.max(0), [acc - x, x - acc])
                    }, elapsedTime, R.values(recipeTimes)))
            var reducedSum = R.sum(R.values(reducedTimes))

            var timeSteps = R.scan(R.add, 0, R.values(recipeTimes))
            var notMaximum = R.compose(R.not, R.equals(R.last(timeSteps)))
            timeSteps = R.filter(notMaximum, timeSteps)
            // Beep when any step reaches 0
            R.when(R.contains(reducedSum), playSound, timeSteps)

            // TODO progress bar
            // FIXME one step behind
            setProgressBars(R.values(recipeTimes), reducedTimes)

            // Print times
            setTimes(reducedTimes)

            // Finished; stop
            R.when(R.equals(0), function() {
                clearInterval(timeLoop)
            }, reducedSum)
        }, 1000)

    } else {
        resetCountDown(this)
    }
}

// TODO
// resetCountDown :: Element -> Void
function resetCountDown(startButton) {
    clearInterval(timeLoop)
    var recipeTimes = recipes[currentRecipe].times
    setTimes(recipeTimes)
    // XXX unstable
    setProgressBars(R.values(recipeTimes), R.values(recipeTimes))
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
    return modifySetting(key, R.identity, defaultValue)
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

