// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// bot.js is your main bot dialog entry point for handling activity types

// Import required Bot Builder
const { ActivityTypes, CardFactory } = require('botbuilder');
const { LuisRecognizer } = require('botbuilder-ai');
const { ChoicePrompt, DialogSet, DialogTurnStatus, TextPrompt, WaterfallDialog } = require('botbuilder-dialogs');


// GET https://www.googleapis.com/customsearch/v1?key=AIzaSyA0vPv-yQ-olzbGZU9TfaDGVmVOAcOXzxk&cx=001289876643541600184:wxrmzurjssa&q=검색어

//const TEXT_PROMPT = 'textPrompt';
//const MAIN_DIALOG = 'mainDialog';

const { UserProfile } = require('./dialogs/greeting/userProfile');
const { GreetingDialog } = require('./dialogs/greeting');
const { WelcomeCard } = require('./dialogs/welcome');
const { Solution1Card } = require('./dialogs/solution1');

const GREETING_DIALOG = 'greetingDialog';
const DIALOG_STATE_PROPERTY = 'dialogState';
const USER_PROFILE_PROPERTY = 'userProfileProperty';
// LUIS service type entry as defined in the .bot file.
const LUIS_CONFIGURATION = 'BasicBotLuisApplication';

// Supported LUIS Intents.
const GREETING_INTENT = 'Greeting';
const WELCOME_INTENT = 'welcome';
const CANCEL_INTENT = 'Cancel';
const HELP_INTENT = 'Help';
const NONE_INTENT = 'None';

const CADENCE_SOLUTION = 'Cadence_Solution';
const CADENCE_TIP = 'Cadence_Tips';
const CADENCE_ENTERTAINER = 'Entertainer';
const ENTERTAINER_FALL = 'Entertainer_fall';

const SOLUTION_ISSUE = 'solution_issue';
const SOLUTION_ISSUE_PROPERTY = 'solution';
const OPERATION_PROMPT = 'operation_prompt';
const TOOL_PROMPT = 'tool_prompt';
const SOLUTION_MESSAGE_C_PROMPT = 'confirm_prompt';
const SOLUTION_MESSAGE_1_PROMPT = 'message1_prompt';
const SOLUTION_MESSAGE_2_PROMPT = 'message2_prompt';
const SOLUTION_MESSAGE_C2_PROMPT = 'confirm2_prompt';
const SOLUTION_MESSAGE_C3_PROMPT = 'confirm3_prompt';

const USER_NAME_ENTITIES = ['userName', 'userName_patternAny'];
const USER_LOCATION_ENTITIES = ['userLocation', 'userLocation_patternAny'];

/**
 * Demonstrates the following concepts:
 *  Displaying a Welcome Card, using Adaptive Card technology
 *  Use LUIS to model Greetings, Help, and Cancel interactions
 *  Use a Waterfall dialog to model multi-turn conversation flow
 *  Use custom prompts to validate user input
 *  Store conversation and user state
 *  Handle conversation interruptions
 */
class BasicBot {
    /**
     * Constructs the three pieces necessary for this bot to operate:
     * 1. StatePropertyAccessor for conversation state
     * 2. StatePropertyAccess for user state
     * 3. LUIS client
     * 4. DialogSet to handle our GreetingDialog
     *
     * @param {ConversationState} conversationState property accessor
     * @param {UserState} userState property accessor
     * @param {BotConfiguration} botConfig contents of the .bot file
     */
    
    constructor(conversationState, userState, botConfig) {
        if (!conversationState) throw new Error('Missing parameter.  conversationState is required');
        if (!userState) throw new Error('Missing parameter.  userState is required');
        if (!botConfig) throw new Error('Missing parameter.  botConfig is required');
        //this.qnaMaker = new BasicBot(endpoint, qnaOptions);

        // Add the LUIS recognizer.
        const luisConfig = botConfig.findServiceByNameOrId(LUIS_CONFIGURATION);
        if (!luisConfig || !luisConfig.appId) throw new Error('Missing LUIS configuration. Please follow README.MD to create required LUIS applications.\n\n');
        this.luisRecognizer = new LuisRecognizer({
            applicationId: luisConfig.appId,
            endpoint: luisConfig.getEndpoint(),
            // CAUTION: Its better to assign and use a subscription key instead of authoring key here.
            endpointKey: luisConfig.authoringKey
        });
        this.conversationState = conversationState;
        this.userState = userState;   
        // Create the property accessors for user and conversation state
        this.userProfileAccessor = userState.createProperty(USER_PROFILE_PROPERTY);
        this.dialogState = conversationState.createProperty(DIALOG_STATE_PROPERTY);
  

        // Create top-level dialog(s)
        this.dialogs = new DialogSet(this.dialogState);
        // Add the Greeting dialog to the set
        this.dialogs.add(new GreetingDialog(GREETING_DIALOG, this.userProfileAccessor));
 
        this.userSolution = userState.createProperty(SOLUTION_ISSUE_PROPERTY);
        this.dialogs.add(new TextPrompt(OPERATION_PROMPT));
        this.dialogs.add(new TextPrompt(TOOL_PROMPT));
        this.dialogs.add(new TextPrompt(SOLUTION_MESSAGE_1_PROMPT));
        this.dialogs.add(new TextPrompt(SOLUTION_MESSAGE_2_PROMPT));
        this.dialogs.add(new ChoicePrompt(SOLUTION_MESSAGE_C_PROMPT));
        this.dialogs.add(new ChoicePrompt(SOLUTION_MESSAGE_C2_PROMPT));
        this.dialogs.add(new ChoicePrompt(SOLUTION_MESSAGE_C3_PROMPT));
        this.dialogs.add(new WaterfallDialog(SOLUTION_ISSUE, [
            this.promptMessageNum1.bind(this),
            this.promptMessageNum2.bind(this),
            this.promptMessageNum3.bind(this),
            this.promptMessageNum4.bind(this),
            this.promptMessageNum5.bind(this),
            this.promptMessageNum6.bind(this)
        ]));
        this.dialogs.add(new WaterfallDialog(ENTERTAINER_FALL, [
            this.promptMessageNum7.bind(this),
            this.promptMessageNum8.bind(this),
            this.promptMessageNum9.bind(this)
        ]));


/*        
        
        // Create a dialog that displays a user name after it has been collected.
        this.dialogs.add(new WaterfallDialog(SOLUTION_COMFIRM, [
            this.displayIssue.bind(this)
        ]));
        */
    }

    /**
     * Driver code that does one of the following:
     * 1. Display a welcome card upon receiving ConversationUpdate activity
     * 2. Use LUIS to recognize intents for incoming user message
     * 3. Start a greeting dialog
     * 4. Optionally handle Cancel or Help interruptions
     *
     * @param {Context} context turn context from the adapter
     */
    async onTurn(context) {
        // Handle Message activity type, which is the main activity type for shown within a conversational interface
        // Message activities may contain text, speech, interactive cards, and binary or unknown attachments.
        // see https://aka.ms/about-bot-activity-message to learn more about the message and other activity types
        if (context.activity.type === ActivityTypes.Message) {
            let dialogResult;
/*
            // Create a dialog context
            const qnaResults = await this.qnaMaker.generateAnswer(turnContext.activity.text);
            // If an answer was received from QnA Maker, send the answer back to the user.
            if (qnaResults[0]) {
                await turnContext.sendActivity(qnaResults[0].answer);

            // If no answers were returned from QnA Maker, reply with help.
            } else {
                await turnContext.sendActivity('No QnA Maker answers were found. This example uses a QnA Maker Knowledge Base that focuses on smart light bulbs. To see QnA Maker in action, ask the bot questions like "Why won\'t it turn on?" or "I need help."');
            }
            // If the Activity is a ConversationUpdate, send a greeting message to the user.
        
    */
            const dc = await this.dialogs.createContext(context);

            // Perform a call to LUIS to retrieve results for the current activity message.
            const results = await this.luisRecognizer.recognize(context);
            const topIntent = LuisRecognizer.topIntent(results);

            // update user profile property with any entities captured by LUIS
            // This could be user responding with their name or city while we are in the middle of greeting dialog,
            // or user saying something like 'i'm {userName}' while we have no active multi-turn dialog.
            await this.updateUserProfile(results, context);
            
            // Based on LUIS topIntent, evaluate if we have an interruption.
            // Interruption here refers to user looking for help/ cancel existing dialog
            const interrupted = await this.isTurnInterrupted(dc, results);
            if (interrupted) {
                if (dc.activeDialog !== undefined) {
                    // issue a re-prompt on the active dialog
                    dialogResult = await dc.repromptDialog();
                } // Else: We dont have an active dialog so nothing to continue here.
            } else {
                // No interruption. Continue any active dialogs.
                dialogResult = await dc.continueDialog();
            }

            // If no active dialog or no active dialog has responded,
            if (!dc.context.responded) {
                // Switch on return results from any active dialog.
                switch (dialogResult.status) {
                // dc.continueDialog() returns DialogTurnStatus.empty if there are no active dialogs
                case DialogTurnStatus.empty:
                    // Determine what we should do based on the top intent from LUIS.
                    switch (topIntent) {
                    case WELCOME_INTENT:
                        const welcomeCard = CardFactory.adaptiveCard(WelcomeCard);
                        await context.sendActivity({ attachments: [welcomeCard] });
                        break;
                    case GREETING_INTENT:
                        await dc.beginDialog(GREETING_DIALOG);
                        break;
                    case CADENCE_SOLUTION: 
                        //await dc.beginDialog(SOLUTION_DIALOG);
                        let Solution_result;
                        Solution_result = JSON.stringify(results);
                        //await context.sendActivity(`"Greetings from sample message ${ Solution_result}.`);
                        await dc.beginDialog(SOLUTION_ISSUE);
                        //await context.sendActivity("Greetings from sample message.");
                       // await dc.context.sendActivity(`Oh~ You got an ${JSON.stringify(results.entities.Cadence_Messages[0])} !! 
                       // \n Do you have the ${JSON.stringify( results.entities.Cadence_Messages[0] )} number?`);
                        //await dc.context.sendActivity(`Solution intent found, entities included:\n ${JSON.stringify(results.entities)}`);
                        break;
                    case CADENCE_ENTERTAINER:
                        await dc.beginDialog(ENTERTAINER_FALL);
                        break;
                    case CADENCE_TIP: 
                        await dc.context.sendActivity(`Tip Line 1st `);
                        await dc.context.sendActivity(`tip intent found, entities included:\n ${JSON.stringify(results.entities)}`);
                        break;


                    case NONE_INTENT:
                    default:
                        await dc.context.sendActivity(`I didn't understand what you just said to me. topIntent ${topIntent}`);
                        break;
                    }    
                    break;
                default:
                    // Unrecognized status from child dialog. Cancel all dialogs.
                    await dc.cancelAllDialogs();
                    break;
                }
            }
        } else if (context.activity.type === ActivityTypes.ConversationUpdate) {
            // Handle ConversationUpdate activity type, which is used to indicates new members add to
            // the conversation.
            // see https://aka.ms/about-bot-activity-message to learn more about the message and other activity types

            // Do we have any new members added to the conversation?
            if (context.activity.membersAdded.length !== 0) {
                // Iterate over all new members added to the conversation
                for (var idx in context.activity.membersAdded) {
                    // Greet anyone that was not the target (recipient) of this message
                    // the 'bot' is the recipient for events from the channel,
                    // context.activity.membersAdded == context.activity.recipient.Id indicates the
                    // bot was added to the conversation.
                    if (context.activity.membersAdded[idx].id !== context.activity.recipient.id) {
                        // Welcome user.
                        // When activity type is "conversationUpdate" and the member joining the conversation is the bot
                        // we will send our Welcome Adaptive Card.  This will only be sent once, when the Bot joins conversation
                        // To learn more about Adaptive Cards, see https://aka.ms/msbot-adaptivecards for more details.
                        const welcomeCard = CardFactory.adaptiveCard(WelcomeCard);
                        await context.sendActivity({ attachments: [welcomeCard] });
                    }
                }
            }
        }

        // make sure to persist state at the end of a turn.
        await this.conversationState.saveChanges(context);
        await this.userState.saveChanges(context);
    }

    /**
     * Look at the LUIS results and determine if we need to handle
     * an interruptions due to a Help or Cancel intent
     *
     * @param {DialogContext} dc - dialog context
     * @param {LuisResults} luisResults - LUIS recognizer results
     */
    async isTurnInterrupted(dc, luisResults) {
        console.log(JSON.stringify(luisResults));
        //kwangho
        const topIntent = LuisRecognizer.topIntent(luisResults);

        // see if there are anh conversation interrupts we need to handle
        if (topIntent === CANCEL_INTENT) {
            if (dc.activeDialog) {
                // cancel all active dialog (clean the stack)
                await dc.cancelAllDialogs();
                await dc.context.sendActivity(`Ok.  I've cancelled our last activity.`);
            } else {
                await dc.context.sendActivity(`I don't have anything to cancel.`);
            }
            return true; // this is an interruption
        }

        if (topIntent === HELP_INTENT) {
            await dc.context.sendActivity(`Let me try to provide some help.`);
            await dc.context.sendActivity(`I understand greetings, being asked for help, or being asked to cancel what I am doing.`);
            return true; // this is an interruption
        }
        return false; // this is not an interruption
    }

    /**
     * Helper function to update user profile with entities returned by LUIS.
     *
     * @param {LuisResults} luisResults - LUIS recognizer results
     * @param {DialogContext} dc - dialog context
     */
    async updateUserProfile(luisResult, context) {
        // Do we have any entities?
        if (Object.keys(luisResult.entities).length !== 1) {
            // get userProfile object using the accessor
            let userProfile = await this.userProfileAccessor.get(context);
            if (userProfile === undefined) {
                userProfile = new UserProfile();
            }
            // see if we have any user name entities
            USER_NAME_ENTITIES.forEach(name => {
                if (luisResult.entities[name] !== undefined) {
                    let lowerCaseName = luisResult.entities[name][0];
                    // capitalize and set user name
                    userProfile.name = lowerCaseName.charAt(0).toUpperCase() + lowerCaseName.substr(1);
                }
            });
            USER_LOCATION_ENTITIES.forEach(city => {
                if (luisResult.entities[city] !== undefined) {
                    let lowerCaseCity = luisResult.entities[city][0];
                    // capitalize and set user name
                    userProfile.city = lowerCaseCity.charAt(0).toUpperCase() + lowerCaseCity.substr(1);
                }
            });
            // set the new values
            await this.userProfileAccessor.set(context, userProfile);
        }
    }
    async promptMessageNum1(step) {
        return await step.prompt(SOLUTION_MESSAGE_C_PROMPT, `Oh~ I see, \n Do you know the Error specific number?`, ['yes', 'no']);
    }
    async promptMessageNum2(step) {
        const solution = await this.userSolution.get(step.context, {});
        solution.num1 = step.result;
        if (step.result && solution.num1.value === 'yes') {
            return await step.prompt(SOLUTION_MESSAGE_1_PROMPT, `What is the number? \n I will search the database regarding the number`);
        }
    }
    async promptMessageNum3(step) {
        const solution = await this.userSolution.get(step.context, {});
        solution.num2 = step.result;
        if (solution.num2 && solution.num1.value === 'yes') {
            await step.prompt(SOLUTION_MESSAGE_2_PROMPT, `Message number \"${ solution.num2 }\", I'm going to search it`);
            return await step.endDialog(); 
        }
    }
    async promptMessageNum4(step) {
        const solution = await this.userSolution.get(step.context, {});
        const solution1Card = CardFactory.adaptiveCard(Solution1Card);
        await step.context.sendActivity({ attachments: [solution1Card] });
        return await step.prompt(SOLUTION_MESSAGE_C2_PROMPT, `Is it helpful to solve your issue? \n Your feedback makes me better!`, [`yes`, `no`]);
    }
    async promptMessageNum5(step) {
        const solution = await this.userSolution.get(step.context, {});
        solution.num3 = step.result;
        if (step.result && solution.num3.value === 'no') {
            return await step.prompt(SOLUTION_MESSAGE_C3_PROMPT, `Do you want me to make an ISSUE Case, which will be submitted to Cadence Support Office?`, ['yes', 'no']);
        } else { 
            return await step.context.sendActivity(`Thanks for your feedback!!`);
        }
    }
    async promptMessageNum6(step) {
        const solution = await this.userSolution.get(step.context, {});
        solution.num4 = step.result;
        if (solution.num4.value === 'yes') {
            return await step.context.sendActivity(`Done! Submitted your Issue, \nCadence engineer will contact you!!`);
        } else { 
            return await step.context.sendActivity(`Thanks, Do you have another issue?`);
        }
        return await step.endDialog();
    }
    async promptMessageNum7(step) {
        //await this.userSolution.set(step.context, solution);
        await step.context.sendActivity(`I am Hanaper Bot!! `);
        return await step.context.sendActivity(`As you watched, I was born at Korea office for Hackaton project
        And assist your design w/ Cadence tools. Just ask whatever you want`);
    }
    async promptMessageNum8(step) {
        await step.context.sendActivity(`Ah~, you mean her, do you want to know her?`);
    }
    async promptMessageNum9(step) {
        await step.context.sendActivity({ attachments: [this.createThumbnailCard()] });
        return await step.context.sendActivity(`She is so beautiful, right?`);
    }
    /*
    async promptTool(step) {
        const solution = await this.userSolution.get(step.context, {});
        solution.num1 = step.result;
        if (solution.num1.value === 'no') {
        return await step.prompt(TOOL_PROMPT, `What tool did you use?`);
        }
    }  
    async promptOperation(step) {
        const solution = await this.userSolution.get(step.context, {});
        solution.tool = step.result;
        if (solution.tool && solution.num1.value === 'no') {
            return await step.prompt(OPERATION_PROMPT, `What step ?hatdfgdfgdfgusing?`);
        }
    }
    // This step captures the user's name, then prompts whether or not to collect an age.
    
    async displayIssue(step) {
        const solution = await this.userSolution.get(step.context, {});
        await step.context.sendActivity(`Your name is ${ solution.tool } and you are ${ solution.oper } years old.`);
        return await step.endDialog();
    }
    */
    
 

    createThumbnailCard() {
        return CardFactory.thumbnailCard(
            'Han Hyo-joo',
            [{ url: 'https://www.asiancrush.com/wp-content/uploads/2017/05/han-hyo-joo.jpg' }],
            [{
                type: 'openUrl',
                title: 'More Information',
                value: 'https://en.wikipedia.org/wiki/Han_Hyo-joo'
            }],
            {
                subtitle: 'South Korean film actress',
                text: 'Han Hyo-joo is a South Korean film and television actress. She is best known for her leading roles in television drama series: Spring Waltz; Brilliant Legacy; Dong Yi and W; as well as the film Cold Eyes, for which she won Best Actress at the 34th Blue Dragon Film Awards, and for the star-studed film, Beauty Inside'
            }
        );
    }

}

module.exports.BasicBot = BasicBot;
