# Voting Thing

The Voting Thing attempts to help group decision making, to draw out the true wisdom of the crowds by filtering out peer pressure.

It was originally created for investment club meetings, where an animated discussion is followed by a buy/sell vote. If the vote is carried out by a show of hands, there can be a reticence to be the first to raise a hand, or alternatively groupthink can cause an already popular vote to get even more votes as individuals harmonise with the group (especially an issue if the magnitude of the vote affects the magnitude of the decision). 

The Voting Thing is an app: each person casts their vote privately on their own device. Votes are however still public, so each person can see how everybody else votes, but **only after they have voted themselves**.

Try it out on [votingthing.com](http://www.votingthing.com/) or as an [iOS](https://itunes.apple.com/us/app/voting-thing/id1024944462?mt=8) or [Android](https://play.google.com/store/apps/details?id=com.votingthing.app&hl=en) app.
 
## Screenshots

The Voting Thing is intended to be generic enough to cover a range of voting scenarios. Here are some screenshots to illustrate the process: 

Creating a poll:

<img src="https://github.com/jacksonp/voting-thing/blob/master/media/Screenshot_2015-07-28-17-11-27.png" width="300">

About to vote - you can see *who* has already voted, but not *how* they have voted:

<img src="https://github.com/jacksonp/voting-thing/blob/master/media/Screenshot_2015-07-28-17-10-32.png" width="300">

Results are visible after voting:

<img src="https://github.com/jacksonp/voting-thing/blob/master/media/Screenshot_2015-07-28-17-10-42.png" width="300">


## Tech

The app is built with Apache Cordova, so is written in cross-platform HTML, CSS & JS. The App and the website use essentially the same source code. Voting data is stored in a PostgreSQL server. Other than that, I wrote the Voting Thing to explore some techie stuff I hadn't previously played with - a couple bits I found interesting: 

- **[Knockout.js](http://knockoutjs.com/)**: binds a JS model and the DOM. Using a client-side Model-View-View-Model (MVVM) framework or library was new to me, knockout.js is a great way to get a feel for how well that can work given its simplicity and lack of dependencies. However work on the project seems to have stagnated, be sure to also look at other options if starting something new. 
 
- **Websockets** are used to transmit voting information between the clients and a Node.js server. These are a challenge to get working properly in a Cordova app, and a pain in the neck to debug as issues can be hard to reproduce. I moved from using *socket.io* to its underlying communication layer, *engine.io*, to finally using *native WebSockets*. It was the only way to have sufficient control to reliably reconnect clients in all scenarios (the app moving to background, the device switching network connection...). But once they're working reliably, WebSockets are fantastic.
