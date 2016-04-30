
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

    , "ap-bluebottle":
        { "title": "AeroPress Blue Bottle"
        , "times":
            { "stir": 5
            , "bloom": 30
            , "pour": 10
            , "wait": 60
            , "press": 30
            }
        , "steps": []
        , "meta":
            {}
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

// TODO negative numbers
var padNumber = function(n) {
    return (""+n).length > 1 ? n : '0' + n
}

// formatTime :: Number -> String
var formatTime = function(n) {
    var prefix = (""+n)[0] === "-" ? "-" : ""
    n = Math.abs(n)
    var tmp = [padNumber(n % 60)]

    while (n / 60 >= 1) {
        n = Math.floor(n / 60)
        tmp = R.prepend(padNumber(n % 60), tmp)
    }

    return prefix + tmp.join(":")
}


// Program

// createTimes :: Void
function createTimes() {
    var timesWrapper = document.querySelector("nav > section")
    var times = recipes[currentRecipe].times

    for (var timeKey in times) {
        var time = times[timeKey]

        var timeElem = document.createElement("time")
        timeElem.dataset.key = timeKey
        timeElem.textContent = formatTime(time)

        var timeProgressElem = document.createElement("span")

        if (time === 0) timeElem.classList.add("hidden")

        timeElem.appendChild(timeProgressElem)
        timesWrapper.appendChild(timeElem)
    }
}

// modifyTimes :: ([Element] -> [a]) -> [a]
var modifyTimes = function(f) {
    var timeElems = document.querySelectorAll("nav time")

    return f(timeElems)
}

// modifyZipTimes :: (Number -> Element -> a) -> [Number] -> [a]
var modifyZipTimes = R.curry(function(f, times) {
    return modifyTimes(R.zipWith(f, times))
})

// setTimes :: [Number] -> Void
var setTimes = modifyZipTimes(function(t, e) {
    e.childNodes[0].nodeValue = formatTime(t)
})

var setProgressBars = function(recipeTimes, reducedTimes) {
    modifyTimes(R.zipWith(function(ts, e) {
        if (ts[0] - ts[1] > 0) {
            e.children[0].style.width = "100%"
            e.children[0].style.transition = "width " + ts[0] + "s linear"
        }
    }, R.zip(recipeTimes, reducedTimes)))
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

// TODO negative numbers
// countDownState :: Event -> Void
function countDownState(e) {
    if (this.value !== resetText) {
        this.value = resetText

        var recipeTimes = recipes[currentRecipe].times
        var startTime = getPOSIXTime()
        var goalTime = startTime + R.sum(R.values(recipeTimes))
        var timeDiff = goalTime - startTime

        var firstNonZero = R.findIndex(R.lt(0), R.values(recipeTimes))
        setProgressBars( R.values(recipeTimes)
                          , R.over( R.lensIndex(firstNonZero)
                                  , R.add(-1)
                                  , R.values(recipeTimes)
                                  )
                          )

        timeLoop = setInterval(function() {
            var elapsedTime = timeDiff - (goalTime - getPOSIXTime())

            // reducedTimes :: [Number]
            var reducedTimes = R.nth(1, R.mapAccum(function(acc, x) {
                    return [acc - x, x - acc]
                }, elapsedTime, R.values(recipeTimes)))

            var minReducedTimes = R.zipWith( R.min
                                           , reducedTimes
                                           , R.values(recipeTimes)
                                           )

            var reducedSum = R.sum(R.map(R.max(0), minReducedTimes))

            var timeSteps = R.scan(R.add, 0, R.values(recipeTimes))

            // Beep when any step reaches 0
            R.when(R.contains(elapsedTime), playSound, timeSteps)

            R.when(R.contains(elapsedTime), function() {
                var firstNonZero = R.findIndex( R.lt(0)
                                              , R.values(reducedTimes)
                                              )
                setProgressBars( R.values(recipeTimes)
                                  , R.over( R.lensIndex(firstNonZero)
                                          , R.add(-1)
                                          , R.values(recipeTimes)
                                          )
                                  )
            }, timeSteps)

            // Print times
            setTimes(minReducedTimes)

            // Fade negative time's color
            modifyZipTimes(function(t, e) {
                if (t <= 0) e.classList.add("faded")
            }, reducedTimes)

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
    var recipeTimes = R.values(recipes[currentRecipe].times)

    clearInterval(timeLoop)

    setTimes(recipeTimes)
    modifyZipTimes(function(t, e) {
        e.classList.remove("faded")

        if (t === 0) e.classList.add("hidden")
        else e.classList.remove("hidden")
    }, recipeTimes)

    modifyTimes(R.map(function(e) {
        e.children[0].style.transition = "width 0.1s linear"
        e.children[0].style.width = "0%"
    }))
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
function setSetting(key, val) { modifySetting(key, R.always(val)) }

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

// XXX necessary for mobile
var removeAutoplayRestriction = function() {
    var f = function(e) {
        var audio = document.querySelector("audio")
        audio.load()

        window.removeEventListener("touchstart", f)
    }

    window.addEventListener("touchstart", f)
}


function main() {
    var selectElem = document.querySelector("header > select")
    createOptions(selectElem)

    selectElem.addEventListener("change", changeRecipe)

    currentRecipe = getSetting("currentRecipe", selectedMethod(selectElem))

    createTimes()

    createMetas()

    removeAutoplayRestriction()

    var startButton = document.querySelector("nav > aside > input")
    startButton.addEventListener("click", countDownState)
}

