if (process.argv[0] === '-help') {
    console.log('file1=file1.csv')
    console.log('file2=file2.csv')
    console.log('output=results')
    console.log('similarity=75')
}
var params = {};

process.argv.forEach(function(val, index, array) {
    var arg = val.split('=');
    if (arg.length == 2) {
        params[arg[0]] = arg[1];
    }
});

if (!params.file1) {
    console.log('Missing file1');
    return;
}

if (!params.file2) {
    console.log('Missing file2');
    return;
}

if (!params.output) {
    params.output = 'results';
}

if (!params.similarity) {
    params.similarity = 0.75;
} else {
    if (isNaN(params.similarity)) {
        console.log('Similarity needs to be an integer');
        return;
    } else {
        params.similarity = parseInt(params.similarity)/100;
    }
}

console.log(params);

var lineReader = require('line-reader'),
    fs = require('fs');

var regex = /(".*?"|[^",]+)(?=\s*,|\s*$)/g;

// base
// First Name,Last Name,Company / Account,Lead ID

// match
// First Name,Last Name,Company

// hash the base's last name and company separately for now
var baseLastNameHash = {};

var matches = [],
    notMatches = [],
    guessedMatches = [],
    badDataFile1 = [],
    badDataFile2 = [];

var firstLine = true;

lineReader.eachLine(params.file1, function(line, last) {
    if (firstLine) {
        firstLine = false;
        return;
    }

    // 'line' contains the current line without the trailing newline character.
    var row = line.match(regex);
  
    //console.log(row);
    try {
        var firstName = row[0];
        var lastName = row[1];
        var company = row[2];
        var leadId = row[3];

        if (lastName && company) {
        	//if (firstName == 'Tim' && lastName == 'Waugh') console.log(row);
            baseLastNameHash[lastName.toLowerCase()] = baseLastNameHash[lastName.toLowerCase()] || {};
            baseLastNameHash[lastName.toLowerCase()][company.toLowerCase()] = line;
        } else {
            badDataFile1.push(params.file1 + ': ' + line);
        }
    } catch (e) {
        console.log(e);
    }

    if (last) {
        processMatches();
    }
});

var processMatches = function() {
    var firstLine = true;
    lineReader.eachLine(params.file2, function(line, last) {
        if (firstLine) {
            firstLine = false;
            return;
        }
        // Now read through the match file and try to match with the base file's hash
        //console.log(line.toString('ascii'));
        var row = line.match(regex);
        //console.log(row);
    
        var firstName = row[0];
        var lastName = row[1];
        var company = row[2];

        if (lastName && company) {
            var companiesToLastName = baseLastNameHash[lastName.toLowerCase()];
            if (companiesToLastName) {
                var baseLastNameCSV = baseLastNameHash[lastName.toLowerCase()][company.toLowerCase()];
                if (baseLastNameCSV) {
                    // If last name and company matches
                    matches.push(baseLastNameCSV);
                } else {
                    var found = false;
                    for (var baseCompany in baseLastNameHash[lastName.toLowerCase()]) {
                        if (baseLastNameHash[lastName.toLowerCase()].hasOwnProperty(baseCompany)) {
                            var similarityP = similarity(baseCompany, company);
                            if (similarityP >= params.similarity) {
                                guessedMatches.push(baseLastNameHash[lastName.toLowerCase()][baseCompany]);
                                found = true;
                                break;
                            }
                        }
                    }
                    if (!found) {
                        notMatches.push(row);
                    }
                }
            } else {
            	notMatches.push(row);
            }
        } else {
            badDataFile2.push(params.file2 + ': ' + line);
        }

        if (last) {
        	var finalMatches = matches.join('\n');
        	if (guessedMatches.length) {
        		finalMatches = finalMatches + '\n-----(' + params.similarity + '%) GUESSES-----\n' + guessedMatches.join('\n');
        	}
            fs.writeFile(params.output + '-matched.csv', finalMatches, 'utf8', function(err) {
                if (err) {
                    return console.log(err);
                } else {
                    // console.log('Matched:');
                    // console.log(matches);
                    console.log('Matches: ' + matches.length);
                    console.log('Guessed: ' + guessedMatches.length);
                }
            });
            fs.writeFile(params.output + '-unmatched.csv', notMatches.join('\n'), 'utf8', function(err) {
                if (err) {
                    return console.log(err);
                } else {
                    // console.log('Not matched:');
                    // console.log(notMatches);
                    console.log('Not matches: ' + notMatches.length);
                }
            });

            if (badDataFile1.length || badDataFile2.length) {
            	fs.writeFile(params.output + '-badData.csv', badDataFile1.join('\n') + '\n' + badDataFile2.join('\n'), 'utf8', function(err) {
	                if (err) {
	                    return console.log(err);
	                } else {
	                    // console.log('Bad Data:');
	                    // console.log(badData);
	                    console.log('Bad data file1: ' + badDataFile1.length);
	                    console.log('Bad data file2: ' + badDataFile2.length);
	                }
	            });
            }

            console.log('Total processed: ' + (matches.length + notMatches.length + badDataFile2.length + guessedMatches.length));
          
        }
    });
};

function similarity(s1, s2) {
    var longer = s1;
    var shorter = s2;
    if (s1.length < s2.length) {
        longer = s2;
        shorter = s1;
    }
    var longerLength = longer.length;
    if (longerLength == 0) {
        return 1.0;
    }
    return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);

    function editDistance(s1, s2) {
        s1 = s1.toLowerCase();
        s2 = s2.toLowerCase();

        var costs = new Array();
        for (var i = 0; i <= s1.length; i++) {
            var lastValue = i;
            for (var j = 0; j <= s2.length; j++) {
                if (i == 0)
                    costs[j] = j;
                else {
                    if (j > 0) {
                        var newValue = costs[j - 1];
                        if (s1.charAt(i - 1) != s2.charAt(j - 1))
                            newValue = Math.min(Math.min(newValue, lastValue),
                                costs[j]) + 1;
                        costs[j - 1] = lastValue;
                        lastValue = newValue;
                    }
                }
            }
            if (i > 0)
                costs[s2.length] = lastValue;
        }
        return costs[s2.length];
    }
}
