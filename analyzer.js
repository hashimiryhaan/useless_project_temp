// ============================================
// BROKEGPT - FINANCIAL ANALYSIS
// ============================================


// --------------------------------------------
// 0. AUDIO UNLOCK (fixes "audio not playing")
// --------------------------------------------
//
// Browsers only allow audio.play() to run
// without restriction inside the same user
// gesture that triggered it. Since we call
// playBrokeGPTAudio() AFTER an `await`
// (Tesseract OCR can take several seconds),
// the gesture window has usually expired by
// the time we try to play, so the browser
// silently blocks it.
//
// Fix: create ONE shared <audio> element and
// "unlock" it synchronously, immediately on
// the button click, BEFORE any await. Once a
// media element has successfully played once
// during a real click, browsers let you keep
// reusing that same element later (even after
// async delays) without needing a fresh gesture.
// --------------------------------------------

const brokeGPTAudioElement = new Audio();
brokeGPTAudioElement.volume = 1.0;

function unlockBrokeGPTAudio() {

    // Play a near-silent, essentially instant
    // "blip" to unlock the element while we
    // still have a real user gesture.
    brokeGPTAudioElement.src =
        "data:audio/mpeg;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA";

    const unlockPromise =
        brokeGPTAudioElement.play();

    if (unlockPromise) {

        unlockPromise
            .then(function () {
                brokeGPTAudioElement.pause();
                brokeGPTAudioElement.currentTime = 0;
            })
            .catch(function () {
                // Ignore - some browsers don't need this at all
            });
    }
}


// --------------------------------------------
// 1. CLASSIFY BALANCE
// --------------------------------------------

function getFinancialCategory(balance) {

    if (balance <= 999) {

        return {
            category: "💀 POOR",

            message:
                "Your balance is so low, even your UPI app is feeling sorry for you. 😭",

            audios: [
                "audio/poor/thani.mpeg.mp3",
                "audio/poor/aadu.mp3",
                "audio/poor/hashir.mp3",
                "audio/poor/lowlevel.mp3",
                "audio/poor/nanban.mp3",
                "audio/poor/nivin.mp3",
                
            ]
        };

    } else {

        return {
            category: "🤑 RICH",

            message:
                "₹1000+ in your account? Look at you acting like a billionaire! 😂",

            audios: [
                "audio/rich/lucky.mp3",
                "audio/rich/3 kodi.mp3",
                "audio/rich/amazing.mp3",
                "audio/rich/badass.mp3",
                "audio/rich/kodikal.mp3",
                "audio/rich/mrmaru.mp3"
            ]
        };
    }
}


// --------------------------------------------
// 2. CHOOSE RANDOM AUDIO
// --------------------------------------------

function getRandomAudio(audioList) {

    if (!audioList || audioList.length === 0) {
        return null;
    }

    const randomIndex =
        Math.floor(Math.random() * audioList.length);

    return audioList[randomIndex];
}


// --------------------------------------------
// 3. EXTRACT BALANCE FROM OCR TEXT
// --------------------------------------------

function extractBalance(text) {

    console.log("OCR TEXT:");
    console.log(text);

    // Convert OCR text into lowercase
    const lowerText = text.toLowerCase();


    // ----------------------------------------
    // Look for balance-related words
    // ----------------------------------------

    const balanceKeywords = [
        "available balance",
        "available bal",
        "avail balance",
        "balance available",
        "current balance",
        "account balance",
        "total balance",
        "balance"
    ];


    // ----------------------------------------
    // Try to find a balance keyword
    // ----------------------------------------

    for (const keyword of balanceKeywords) {

        const keywordIndex = lowerText.indexOf(keyword);

        if (keywordIndex !== -1) {

            // Take the text after the keyword
            const textAfterKeyword =
                text.substring(keywordIndex);

            console.log(
                "Text around balance:",
                textAfterKeyword
            );


            // --------------------------------
            // Look for ₹ / Rs / INR
            // --------------------------------

            const currencyMatch =
                textAfterKeyword.match(
                    /(?:₹|rs\.?|inr)\s*([0-9][0-9,\s]*(?:\.[0-9]{1,2})?)/i
                );


            if (currencyMatch) {

                const number =
                    currencyMatch[1]
                        .replace(/,/g, "")
                        .replace(/\s/g, "");

                const balance =
                    parseFloat(number);

                if (!isNaN(balance)) {
                    return balance;
                }
            }


            // --------------------------------
            // If currency symbol was missed
            // --------------------------------

            const numberMatch =
                textAfterKeyword.match(
                    /\b([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?)\b/
                );


            if (numberMatch) {

                const number =
                    numberMatch[1].replace(/,/g, "");

                const balance =
                    parseFloat(number);

                if (!isNaN(balance)) {
                    return balance;
                }
            }
        }
    }


    // ----------------------------------------
    // Try currency search in entire OCR text
    // ----------------------------------------

    const fullCurrencyMatch =
        text.match(
            /(?:₹|rs\.?|inr)\s*([0-9][0-9,\s]*(?:\.[0-9]{1,2})?)/i
        );


    if (fullCurrencyMatch) {

        const number =
            fullCurrencyMatch[1]
                .replace(/,/g, "")
                .replace(/\s/g, "");

        const balance =
            parseFloat(number);

        if (!isNaN(balance)) {
            return balance;
        }
    }


    // ----------------------------------------
    // LAST RESORT: no keyword and no currency
    // symbol matched at all (common when OCR
    // misreads ₹/Rs on a photographed screen).
    //
    // Look for a decimal money-shaped number
    // anywhere in the text (e.g. "1,234.56" or
    // "0.24"). Decimal amounts are preferred
    // because they rarely appear in account
    // numbers / phone numbers / dates, so this
    // is a fairly safe guess.
    // ----------------------------------------

    const decimalNumberMatches =
        text.match(
            /\b[0-9]{1,3}(?:,[0-9]{2,3})*\.[0-9]{1,2}\b/g
        );

    if (decimalNumberMatches && decimalNumberMatches.length > 0) {

        const number =
            decimalNumberMatches[0].replace(/,/g, "");

        const balance =
            parseFloat(number);

        if (!isNaN(balance)) {

            console.log(
                "Balance found via fallback decimal match:",
                balance
            );

            return balance;
        }
    }


    // ----------------------------------------
    // Nothing found
    // ----------------------------------------

    return null;
}


// --------------------------------------------
// 4. ANALYZE IMAGE
// --------------------------------------------

async function analyzeBalanceImage(imageSource) {

    console.log("Starting OCR...");


    const result =
        await Tesseract.recognize(
            imageSource,
            "eng",
            {
                logger: function (info) {

                    console.log(info);
                }
            }
        );


    const ocrText =
        result.data.text;


    console.log("OCR completed.");
    console.log(ocrText);


    // Get balance
    const balance =
        extractBalance(ocrText);


    if (balance === null) {

        return {
            success: false,

            message:
                "Sorry 😭 BrokeGPT couldn't find your balance. Try a clearer image."
        };
    }


    // Classify balance
    const financialResult =
        getFinancialCategory(balance);


    // Choose audio
    const audio =
        getRandomAudio(
            financialResult.audios
        );


    return {

        success: true,

        balance: balance,

        category:
            financialResult.category,

        message:
            financialResult.message,

        audio: audio
    };
}


// --------------------------------------------
// 5. PLAY AUDIO
// --------------------------------------------

function playBrokeGPTAudio(audioPath) {

    if (!audioPath) {
        return;
    }


    console.log("Playing audio:");
    console.log(audioPath);


    // Reuse the SAME element we unlocked on click,
    // instead of `new Audio(...)`, so the browser
    // still treats this as continuing an
    // already-permitted playback session.
    brokeGPTAudioElement.src =
        audioPath;

    brokeGPTAudioElement.currentTime = 0;

    brokeGPTAudioElement.play()
        .then(function () {

            console.log("AUDIO PLAYING 🎵");

        })
        .catch(function (error) {

            console.error(
                "Audio could not play. Path tried:",
                audioPath
            );

            console.error(
                "Error name:",
                error.name
            );

            console.error(
                "Error message:",
                error.message
            );

            const mediaError =
                brokeGPTAudioElement.error;

            if (mediaError) {

                // 1 = ABORTED, 2 = NETWORK, 3 = DECODE,
                // 4 = SRC_NOT_SUPPORTED (this is what you
                // get for a 404 / wrong path / missing file)
                console.error(
                    "MediaError code:",
                    mediaError.code
                );
            }

            if (error.name === "NotAllowedError") {

                alert(
                    "Your browser blocked the audio. Please click the page once and try again."
                );

            } else {

                alert(
                    "Could not load this audio file:\n" +
                    audioPath +
                    "\n\nCheck that this file actually exists at that path relative to your HTML file (open DevTools Console for details)."
                );
            }
        });
}


// --------------------------------------------
// 6. DISPLAY RESULT
// --------------------------------------------

function displayBrokeGPTResult(result) {

    const resultSection =
        document.getElementById("resultSection");

    const balanceText =
        document.getElementById("balanceText");

    const categoryText =
        document.getElementById("categoryText");

    const roastMessage =
        document.getElementById("roastMessage");


    // ----------------------------------------
    // If balance was not found
    // ----------------------------------------

    if (!result.success) {

        balanceText.innerText =
            "Balance: Not Found 😭";

        categoryText.innerText =
            "🤷 UNKNOWN";

        roastMessage.innerText =
            result.message;

        resultSection.style.display =
            "block";

        return;
    }


    // ----------------------------------------
    // Show balance
    // ----------------------------------------

    balanceText.innerText =
        "Available Balance: ₹" +
        result.balance;


    // ----------------------------------------
    // Show category
    // ----------------------------------------

    categoryText.innerText =
        result.category;


    // ----------------------------------------
    // Show roast
    // ----------------------------------------

    roastMessage.innerText =
        result.message;


    // ----------------------------------------
    // Show result section
    // ----------------------------------------

    resultSection.style.display =
        "block";


    // ----------------------------------------
    // PLAY AUDIO
    // ----------------------------------------

    if (result.audio) {

        playBrokeGPTAudio(
            result.audio
        );
    }
}


// --------------------------------------------
// 7. MAIN FUNCTION
// --------------------------------------------

async function runBrokeGPTAnalysis(imageSource) {

    try {

        console.log(
            "BrokeGPT analysis started..."
        );


        const result =
            await analyzeBalanceImage(
                imageSource
            );


        displayBrokeGPTResult(
            result
        );


    } catch (error) {

        console.error(
            "Analysis error:",
            error
        );


        alert(
            "Something went wrong while analyzing the image. 😭"
        );
    }
}