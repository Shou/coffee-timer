
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
    }
// }}}

var options =
    { "manual": false
    , "beep": true
    }

// timeLoop :: Interval
var timeLoop = null

// currentRecipe :: String
var currentRecipe = null

// wasDocumentHidden :: Bool
var wasDocumentHidden = false

// beepWorker :: WebWorker
var beepWorker = null


// Utils

// | Get POSIX time in seconds
// getPOSIXTime :: IO Integer
var getPOSIXTime = function() { return Date.now() / 1000 | 0 }

// TODO negative numbers
// padNumber :: Number -> String
var padNumber = function(n) {
    return (""+n).length > 1 ? n : '0' + n
}

// formatTime :: Number -> String
var formatTime = function(n) {
    var prefix = (""+n)[0] === "-" ? "-" : ""
    n = Math.abs(n)
    var tmp = [padNumber(mod(n, 60))]

    while (n / 60 >= 1) {
        n = Math.floor(n / 60)
        tmp = R.prepend(padNumber(mod(n, 60)), tmp)
    }

    return prefix + tmp.join(":")
}

// parseTime :: String -> Number
var parseTime = function(s) {
    var ts = s.split(":")
    var total = 0

    for (var i = 0, l = ts.length; i < l; i++)
        total += Math.pow(60, (l - i - 1)) * parseInt(ts[i])

    return total
}

// findNotZeroIndex :: [Number] -> Number
var findNotZeroIndex = R.findIndex(R.lt(0))

var mod = function(n, m) { return ((n % m) + m) % m }


// Program

// editTime :: Event -> Void
var editTime = function(e) {
    var editElem = this.children[1]
    editElem.focus()
}

// saveTime :: Event -> Void
var saveTime = function(e) {
    var newTime = parseTime(this.value)

    if (R.not(isNaN(newTime))) {
        var timeKey = this.parentNode.dataset.key
        var path = R.lensPath([currentRecipe, "times", timeKey])
        recipes = R.set(path, newTime, recipes)
        setSetting("recipes", recipes)

        resetCountDown()
    }

    this.value = ""
}

// cancelEdit :: Event -> Void
var cancelEdit = function(e) {
    // ESC
    if (e.keyCode === 27) this.value = "", this.blur()
    // Enter
    else if (e.keyCode === 13) this.blur()
}

// tabShift :: Event -> Void
var tabShift = function(e) {
    if (e.keyCode === 9) {
        e.preventDefault()

        var tabElems = document.getElementsByClassName("tabbable")
        // No hidden elements
        tabElems = R.filter(R.path(["offsetParent"]), tabElems)
        var tabIndex = R.findIndex(R.equals(e.target), tabElems)
        var tabDirection = e.shiftKey ? -1 : 1

        var tabElem = ( i = mod(tabIndex + tabDirection, tabElems.length)
                      , tabElems[i]
                      )

        if (tabElem) tabElem.focus()
    }
}

// createTimes :: Void
function createTimes() {
    var timesWrapper = document.querySelector("nav > section")
    var times = recipes[currentRecipe].times

    for (var timeKey in times) {
        var time = times[timeKey]

        var timeElem = document.createElement("time")
        timeElem.dataset.key = timeKey
        timeElem.textContent = formatTime(time)

        timeElem.addEventListener("click", editTime)

        var timeProgressElem = document.createElement("span")
        var editElem = document.createElement("input")
        editElem.classList.add("tabbable")

        editElem.addEventListener("blur", saveTime)
        editElem.addEventListener("keydown", cancelEdit)

        if (time === 0) timeElem.classList.add("hidden")

        timeElem.appendChild(timeProgressElem)
        timeElem.appendChild(editElem)
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

var setProgressBar = R.curry(function(index, width, time) {
    modifyTimes(function(timeElems) {
        if (index >= 0 && index < timeElems.length) {
            var bar = timeElems[index].children[0]
            bar.style.width = width + "%"
            bar.style.transition = "width " + time + "s linear"
        }
    })
})

// TODO leverage adding more options live
// createOptions :: Element -> Void
function createOptions(selectElem) {
    // Remove old children
    R.times(function(n) {
        selectElem.removeChild(selectElem.children[0])
    }, selectElem.children.length)

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

// FIXME trim some fat on this function
// countDownState :: Event -> Void
function countDownState(e) {
    if (this.value !== resetText) {
        this.value = resetText

        var recipeTimes = R.values(recipes[currentRecipe].times)
        var timeSteps = R.scan(R.add, 0, recipeTimes)
        var startTime = getPOSIXTime()
        var goalTime = startTime + R.sum(recipeTimes)
        var timeDiff = goalTime - startTime

        var notZeroIndex = findNotZeroIndex(recipeTimes)
        setProgressBar( notZeroIndex
                      , 100
                      , recipeTimes[notZeroIndex]
                      )

        var notZero = R.compose(R.not, R.equals(0))
        beepWorker.postMessage(R.filter(notZero, timeSteps))

        timeLoop = setInterval(function() {
            var elapsedTime = timeDiff - (goalTime - getPOSIXTime())

            // XXX workers
            // Beep when any step reaches 0
            //R.when(R.contains(elapsedTime), playSound, timeSteps)

            // Don't waste CPU cycles!
            if (! document.hidden) {
                // reducedTimes :: [Number]
                var reducedTimes = R.nth(1, R.mapAccum(function(acc, x) {
                        return [acc - x, x - acc]
                    }, elapsedTime, recipeTimes))

                var minReducedTimes = R.zipWith( R.min
                                               , reducedTimes
                                               , recipeTimes
                                               )
                var minZeroReducedTimes = R.map(R.max(0), minReducedTimes)

                // TODO set ALL bars
                // Resume progress bars
                if (wasDocumentHidden) {
                    var notZeroIndex =
                        findNotZeroIndex(reducedTimes)
                    R.map(function(index) {
                        var currentWidth =
                            ( x = recipeTimes[index]
                            , y = minZeroReducedTimes[index]
                            , ((x - y) / x) * 100
                            )
                        setProgressBar(index, currentWidth, 0)
                    }, R.range(0, minReducedTimes.length))
                    // XXX hack: let bar width adjust first
                    setTimeout(function() {
                        setProgressBar( notZeroIndex
                                      , 100
                                      , reducedTimes[notZeroIndex]
                                      )
                    }, 10)

                    // Reset
                    wasDocumentHidden = false
                }

                // Set further progress bars
                R.when(R.contains(elapsedTime), function() {
                    var notZeroIndex =
                        findNotZeroIndex(reducedTimes)
                    setProgressBar( notZeroIndex
                                  , 100
                                  , recipeTimes[notZeroIndex]
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
                }, R.sum(minZeroReducedTimes))
            }
        }, 1000)

    } else {
        resetCountDown()
    }
}

// resetCountDown :: Void
function resetCountDown() {
    beepWorker.postMessage(null)

    var startButton = document.querySelector("nav > aside > input")

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
function changeRecipeState(e) {
    currentRecipe = this.value

    setSetting("currentRecipe", currentRecipe)

    resetCountDown()
}

// modifySetting :: String -> (a -> b) -> b -> b
function modifySetting(key, f, defaultValue) {
    var tmp
    try {
        tmp = f(JSON.parse(localStorage[key]))
        defaultValue = tmp
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

var addRecipe = function(e) {
    var input = this.nextElementSibling.nextElementSibling
    input.style.display = "block"
    input.focus()
}

var removeRecipe = function(e) {
    delete recipes[currentRecipe]
    setSetting("recipes", recipes)

    var select = this.parentNode.children[0]
    createOptions(select)
    changeRecipeState.call(select)
}

var saveRecipe = function(e) {
    this.style.display = "none"

    if (this.value.length > 0) {
        recipes["custom-" + this.value] =
            { title: this.value
            , times:
                { "stir": 1
                , "bloom": 1
                , "pour": 1
                , "wait": 1
                , "press": 1
                }
            }

        setSetting("recipes", recipes)
        createOptions(this.parentNode.children[0])

        var select = this.parentNode.children[0]
        select.selectedIndex = select.children.length - 1
        changeRecipeState.call(select)

        resetCountDown()

        this.value = ""
    }
}

var resume = function(e) {
    if (document.hidden) wasDocumentHidden = true
}


function main() {
    beepWorker = new Worker("beep.js")
    beepWorker.addEventListener("message", function(e) {
        playSound()
    })

    recipes = getSetting("recipes", recipes)

    var selectElem = document.querySelector("header > select")
    createOptions(selectElem)

    selectElem.addEventListener("change", changeRecipeState)

    var createButtons =
        document.querySelectorAll("header > input[type='button']")
    createButtons[0].addEventListener("click", addRecipe)
    createButtons[1].addEventListener("click", removeRecipe)
    var createInput = createButtons[1].nextElementSibling
    createInput.addEventListener("blur", saveRecipe)
    createInput.addEventListener("keydown", cancelEdit)

    currentRecipe = getSetting("currentRecipe", selectedMethod(selectElem))

    createTimes()

    //createMetas()

    removeAutoplayRestriction()

    var startButton = document.querySelector("nav > aside > input")
    startButton.addEventListener("click", countDownState)

    window.addEventListener("keydown", tabShift)

    document.addEventListener("visibilitychange", resume)
}

