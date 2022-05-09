var PEEP_METADATA = {
	   tft: {frame:0, color:"#4089DD"}, 
	 all_d: {frame:1, color:"#52537F"},
	 all_c: {frame:2, color:"#FF75FF"},
	grudge: {frame:3, color:"#efc701"},
	prober: {frame:4, color:"#f6b24c"},
	  tf2t: {frame:5, color:"#88A8CE"},
	pavlov: {frame:6, color:"#86C448"},
	random: {frame:7, color:"#FF5E5E"}
};

var PD = {};
PD.COOPERATE = "COOPERATE";
PD.CHEAT = "CHEAT";

PD.PAYOFFS_DEFAULT = {
	P: 0, // punishment: neither of you get anything
	S: -1, // sucker: you put in coin, other didn't.
	R: 2, // reward: you both put 1 coin in, both got 3 back
	T: 3 // temptation: you put no coin, got 3 coins anyway
};

PD.PAYOFFS = JSON.parse(JSON.stringify(PD.PAYOFFS_DEFAULT));

subscribe("pd/editPayoffs", function(payoffs){
	PD.PAYOFFS = payoffs;
});
subscribe("pd/editPayoffs/P", function(value){ PD.PAYOFFS.P = value; });
subscribe("pd/editPayoffs/S", function(value){ PD.PAYOFFS.S = value; });
subscribe("pd/editPayoffs/R", function(value){ PD.PAYOFFS.R = value; });
subscribe("pd/editPayoffs/T", function(value){ PD.PAYOFFS.T = value; });
subscribe("pd/defaultPayoffs", function(){

	PD.PAYOFFS = JSON.parse(JSON.stringify(PD.PAYOFFS_DEFAULT));

	publish("pd/editPayoffs/P", [PD.PAYOFFS.P]);
	publish("pd/editPayoffs/S", [PD.PAYOFFS.S]);
	publish("pd/editPayoffs/R", [PD.PAYOFFS.R]);
	publish("pd/editPayoffs/T", [PD.PAYOFFS.T]);

});

PD.NOISE = 0;
subscribe("rules/noise",function(value){
	PD.NOISE = value;
});

PD.getPayoffs = function(move1, move2){
	var payoffs = PD.PAYOFFS;
	if(move1==PD.CHEAT && move2==PD.CHEAT) return [payoffs.P, payoffs.P]; // both punished
	if(move1==PD.COOPERATE && move2==PD.CHEAT) return [payoffs.S, payoffs.T]; // sucker - temptation
	if(move1==PD.CHEAT && move2==PD.COOPERATE) return [payoffs.T, payoffs.S]; // temptation - sucker
	if(move1==PD.COOPERATE && move2==PD.COOPERATE) return [payoffs.R, payoffs.R]; // both rewarded
};

// Calculate the welfare in the system (total coins)
PD.getTotalWelfare = function(agents){
  var welfare = 0;
  for(var i=0; i<agents.length; i++){
    welfare += agents[i].coins;
  }
  return welfare;
}
PD.getAverageWelfare = function(agents){
  var totalWelfare = PD.getTotalWelfare(agents);
  return totalWelfare/(agents.length);
}
PD.getSDWelfare = function(agents){
  var mean = PD.getAverageWelfare(agents);
  var runningTotal = 0;
  for(var i=0; i<agents.length; i++){
    runningTotal += Math.pow((agents[i].coins - mean), 2);
  }
  return Math.pow(runningTotal/agents.length, 0.5);
}

PD.playOneGame = function(playerA, playerB, agents){
  // console.log("playOneGame");
  // Get opponents coin values
  var ACoins = playerA.getCoins();
  var BCoins = playerB.getCoins();

	// Make your moves!
	var A = playerA.play(BCoins, agents);
	var B = playerB.play(ACoins, agents);

	// Noise: random mistakes, flip around!
	if(Math.random()<PD.NOISE) A = ((A==PD.COOPERATE) ? PD.CHEAT : PD.COOPERATE);
	if(Math.random()<PD.NOISE) B = ((B==PD.COOPERATE) ? PD.CHEAT : PD.COOPERATE);
	
	// Get payoffs
	var payoffs = PD.getPayoffs(A,B);

	// Remember own & other's moves (or mistakes)
	playerA.remember(A, B);
	playerB.remember(B, A);
	
	var repChangeOnCoop = 1
	var repChangeOnCheat = -2

	// Change Reputation - we can change these values as we wish
	if(B == PD.CHEAT){
		playerB.changeRep(repChangeOnCheat);
	} else if (B == PD.COOPERATE){
		playerB.changeRep(repChangeOnCoop);
	}
	  if(A == PD.CHEAT){
		playerA.changeRep(repChangeOnCheat);
	} else if (A == PD.COOPERATE){
		playerA.changeRep(repChangeOnCoop);
	}

  // wealth redistribution for RH character
  // IMPORTANT: on below lines, "robinhood2" will need to change to match whatever robinhood is id'd as
  if(playerA.getStrategy() == "robinhood2" || playerB.getStrategy() == "robinhood2"){ // if someone is robinhood
    // console.log("here comes robinhood!");

    // find poorest agents
    var poor_agents = [];
    for(var i = agents.length - 1; i >= 0; i--) { poor_agents.push(agents[i]); }
    poor_agents = poor_agents.sort((a, b) => {return (a.coins - b.coins)});
    // // For testing:
    // console.log(`The poorest: (1) Player ${agents.findIndex((x) => x == poor_agents[0])}
    //   with $${poor_agents[0].coins} \n (2) Player ${agents.findIndex((x) => x == poor_agents[1])}
    //   with $${poor_agents[1].coins} \n (3) Player ${agents.findIndex((x) => x == poor_agents[2])}
    //   with $${poor_agents[2].coins}`);

    // console.log(`pA${playerA.getStrategy()}:$${playerA.coins}:${A};
    //   \npB${playerB.getStrategy()}:$${playerB.coins}:${B};
    //   \nThresh: ${PD.getAverageWelfare(agents) + PD.getSDWelfare(agents)}`);
    var poorThreshold = PD.getAverageWelfare(agents) - PD.getSDWelfare(agents); // RH won't redistribute wealth if below this
    if(playerA.getStrategy() == "robinhood2" && payoffs[0] == PD.PAYOFFS.T && ACoins > poorThreshold) { // if A succeeded as robinhood
      for(var i = 0; i < PD.PAYOFFS.T; i++){
        poor_agents[i].addPayoff(1);
      }
      payoffs[0] = 0;
    }
    if(playerB.getStrategy() == "robinhood2" && payoffs[1] == PD.PAYOFFS.T && BCoins > poorThreshold) { // if B succeeded as robinhood
      for(var i = 0; i < PD.PAYOFFS.T; i++){
        poor_agents[i].addPayoff(1);
      }
      payoffs[1] = 0;
    }
  }

	// Add to scores (only in tournament?)
	playerA.addPayoff(payoffs[0]);
	playerB.addPayoff(payoffs[1]);

	// Return the payoffs...
	return payoffs;

};

PD.playRepeatedGame = function(playerA, playerB, turns, agents){
	// I've never met you before, let's pretend
	playerA.resetLogic();
	playerB.resetLogic();

	// Play N turns
	var scores = {
		totalA:0,
		totalB:0,
		payoffs:[]
	};
	
	for(var i=0; i<turns; i++){

		//Example code for a skip game based on reputation function
    /*
		if(Math.random() > playerA.repErrorRate && playerA.getReputation() > playerA.repThreshold && playerB.getReputation() < playerA.repThreshold){
			continue;
		} else if(Math.random() > playerB.repErrorRate && playerA.getReputation() < playerB.repThreshold && playerB.getReputation() > playerB.repThreshold){
			continue;
		} */

		var p = PD.playOneGame(playerA, playerB, agents);
		scores.payoffs.push(p);
		scores.totalA += p[0];
		scores.totalB += p[1];
	}

	// Return the scores...
	return scores;

};

PD.playOneTournament = function(agents, turns){

	// Reset everyone's coins
	for(var i=0; i<agents.length; i++){
		agents[i].resetCoins();
	}

	// Round robin!
	for(var i=0; i<agents.length; i++){
		var playerA = agents[i];
		for(var j=i+1; j<agents.length; j++){
			var playerB = agents[j];
			PD.playRepeatedGame(playerA, playerB, turns, agents);
		}	
	}
  // console.log("AGENT0COINS: "+agents[0].coins);
  // console.log("TOTAL WELFARE: "+PD.getTotalWelfare(agents));
  // console.log("Average WELFARE: "+PD.getAverageWelfare(agents));
  // console.log("SD WELFARE: "+PD.getSDWelfare(agents));
}
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

//copycat
function Logic_tft(){
	var self = this;
	var otherMove = PD.COOPERATE;
	self.play = function(opponentCoins, agents){
		return otherMove;
	};
	self.remember = function(own, other){
		otherMove = other;
	};
}

//copykitten
function Logic_tf2t(){
	var self = this;
	var howManyTimesCheated = 0;
	self.play = function(opponentCoins, agents){
		if(howManyTimesCheated>=2){
			return PD.CHEAT; // retaliate ONLY after two betrayals
		}else{
			return PD.COOPERATE;
		}
	};
	self.remember = function(own, other){
		if(other==PD.CHEAT){
			howManyTimesCheated++;
		}else{
			howManyTimesCheated = 0;
		}
	};
}

function Logic_grudge(){
	var self = this;
	var everCheatedMe = false;
	self.play = function(opponentCoins, agents){
		if(everCheatedMe) return PD.CHEAT;
		return PD.COOPERATE;
	};
	self.remember = function(own, other){
		if(other==PD.CHEAT) everCheatedMe=true;
	};
}

function Logic_all_d(){
	var self = this;
	self.play = function(opponentCoins, agents){
		return PD.CHEAT;
	};
	self.remember = function(own, other){
		// nah
	};
}

function Logic_all_c(){
	var self = this;
	self.play = function(opponentCoins, agents){
		return PD.COOPERATE;
	};
	self.remember = function(own, other){
		// nah
	};
}

function Logic_random(){
	var self = this;
	self.play = function(opponentCoins, agents){
		return (Math.random()>0.5 ? PD.COOPERATE : PD.CHEAT);
	};
	self.remember = function(own, other){
		// nah
	};
}

// Start off Cooperating
// Then, if opponent cooperated, repeat past move. otherwise, switch.
function Logic_pavlov(){
	var self = this;
	var myLastMove = PD.COOPERATE;
	self.play = function(opponentCoins, agents){
		return myLastMove;
	};
	self.remember = function(own, other){
		myLastMove = own; // remember MISTAKEN move
		if(other==PD.CHEAT) myLastMove = ((myLastMove==PD.COOPERATE) ? PD.CHEAT : PD.COOPERATE); // switch!
	};
}

// TEST by Cooperate | Cheat | Cooperate | Cooperate
// If EVER retaliates, keep playing TFT
// If NEVER retaliates, switch to ALWAYS DEFECT
function Logic_prober(){

	var self = this;

	var moves = [PD.COOPERATE, PD.CHEAT, PD.COOPERATE, PD.COOPERATE];
	var everCheatedMe = false;

	var otherMove = PD.COOPERATE;
	self.play = function(opponentCoins, agents){
		if(moves.length>0){
			// Testing phase
			var move = moves.shift();
			return move;
		}else{
			if(everCheatedMe){
				return otherMove; // TFT
			}else{
				return PD.CHEAT; // Always Cheat
			}
		}
	};
	self.remember = function(own, other){
		if(moves.length>0){
			if(other==PD.CHEAT) everCheatedMe=true; // Testing phase: ever retaliated?
		}
		otherMove = other; // for TFT
	};

}

// ORIGINAL RH LOGIC (not hooked up to any current player)
function Logic_robinhood(){
  var self = this;
  self.play = function(opponentCoins, agents){
    var threshold = PD.getAverageWelfare(agents) + PD.getSDWelfare(agents);
    return ((opponentCoins > threshold) ? PD.CHEAT : PD.COOPERATE);
  };
  self.remember = function(own, other){
    // nah
  };
}

// IMPROVED RH LOGIC (not hooked up to any current player)
// plays like tf2t, except always cheats the rich.
// after cheating someone, wealth is redistributed among the poorest (unless RH is critically poor)
function Logic_robinhood2(){
  var self = this;

  var firstRound = true;
  var threshold = 0;
  var oppIsRich = false;
  var howManyTimesCheated = 0;

  self.play = function(opponentCoins, agents){
    if(firstRound){
      threshold = PD.getAverageWelfare(agents) + PD.getSDWelfare(agents);
      oppIsRich = opponentCoins > threshold;
      firstRound = false;
    }

    if(oppIsRich) { return PD.CHEAT; }

    // tf2t logic
    if(howManyTimesCheated>=2){
      return PD.CHEAT; // retaliate ONLY after two betrayals
    }else{
      return PD.COOPERATE;
    }
  };
  self.remember = function(own, other){
    if(other==PD.CHEAT){
      howManyTimesCheated++;
    }else{
      howManyTimesCheated = 0;
    }
  };
}
