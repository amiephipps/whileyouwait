var whileYouWait = {};

whileYouWait.clickOfBeginButton = function() {
	$('.begin').on('click', function() {
		$('.begin, .headerText, #resetQuiz').hide();
		$('label, #publicationChoice').fadeIn();
	});
	$('input[name=articleChoice]').on('click', function() {
		$('label, #publicationChoice, #resetQuiz').hide();
		$('#intersection, #intersectionQuestion').fadeIn();
	});
	$('#intersection').on('change', function() {
		$('#intersection, #intersectionQuestion, #resetQuiz').hide();
		$('#stopQuestion, #stop').fadeIn() 
	});
	$('#stop').on('change', function() {
		$('#stop, #stopQuestion, #resetQuiz').hide();
		$('#routeQuestion, #route').fadeIn() 
	});
	$('#route').on('change', function() {
		$('#route, #routeQuestion').hide();
		$('.selection').addClass('displayNone');
		$('.link').fadeIn() 
		$('.title').fadeIn();
		$('.article').fadeIn();
		$('#resetQuiz').fadeIn ();
	});
};

whileYouWait.setupEventHandlers = function() {
	$('#intersection').on('change', function() {
		var userIntersectionChoice = $(this).val();
		$('#stop option:not(.placeholder)').remove();

		$.ajax({
			url: 'http://myttc.ca/' + userIntersectionChoice + '.json',
			method: 'GET',
			dataType: 'jsonp'
		}).then(function(ttcIntersection) {
			whileYouWait.ttcStops = ttcIntersection.stops;
			$.each(whileYouWait.ttcStops, function(i, value) {
				var ttcStopParsed = value.name;
				var stopSelect = $('#stop');
				var stopOption = $('<option value="' + i + '">' + ttcStopParsed + '</option>');
				stopSelect.append(stopOption);
			});
		});
	});

	$('#stop').on('change', function() {
		var userStopChoice = $(this).val();
		$('#route option:not(.placeholder)').remove();

		$.each(whileYouWait.ttcStops[userStopChoice].routes, function(i, value) {
			var ttcRouteName = value.name;
			var routeSelect = $('#route');
			var routeOption = $('<option value="' + ttcRouteName + '">' + ttcRouteName + '</option>');
			routeSelect.append(routeOption);
		});
	});

	$('#route').on('change', function() {
		var userStopChoice = $('#stop').val();
		var userRouteChoice = $(this).val();

		$.each( whileYouWait.ttcStops[userStopChoice].routes, function(i, value) {
			if (userRouteChoice === value.name) {
				whileYouWait.stopTime = value.stop_times[0].departure_timestamp;
			}
		});

		//create new date, and find the difference between the userStopTime and current time
   	var now = new Date();
		var date = new Date(whileYouWait.stopTime * 1000);
		var minFromNow = (Math.abs(date - now)/(1000*60));
		var userArticleChoice = $('input[name=articleChoice]:checked', 'form').val();

		//if the user selects NYT then get the NYT articles or if Medium then get the Medium ones
		if (userArticleChoice === 'nyt') {
			whileYouWait.displayArticle(minFromNow);
		} else if (userArticleChoice === 'medium') {
			whileYouWait.displayMediumArticle(minFromNow);
		}
	});
};

//get the users location using geolocation api
whileYouWait.getUserLocationAndTTCRoutes = function() {
	if (navigator.geolocation) {
		navigator.geolocation.getCurrentPosition(function(position) {

			var x = position.coords.latitude;
			var y = position.coords.longitude;

			$.ajax({
				url: 'http://myttc.ca/near/' + x + ',' + y + '.json',
				method: 'GET',
				dataType: 'jsonp'
			}).then(function(ttcData) {
				whileYouWait.ttcInfo = ttcData.locations;

				//loop through the routes array and create option elements for the drop down list for which intersection the user is at and populate it
				var select = $('#intersection');
				$.each(whileYouWait.ttcInfo, function(i, value) {
					var option = $('<option value="' + value.uri + '">' + value.name + '</option>');
					select.append(option);
				});
			});
		});
	} else {
		$('<h2>').text('Geolocation is not supported!');
	} 
};

//function that waits for the nytApiHelper promise, when all done, creates an array of objects. The objects have the nyt times articles in it. Then loop through the articles and add a property called readLength and calculate how long it takes to read it
whileYouWait.getNYTArticles = function() {
	var nytApiHelper = function(page) {
		return $.ajax({
			url: 'http://api.nytimes.com/svc/search/v2/articlesearch.json?fq=news_desk:("Magazine")page=' + page + '&sort=newest&api-key=40a2547bb347a04e0e2e160f98087477:1:73227052&',
			data: page,
			method: 'GET',
			dataType: 'json'
		});
	}

	$.when(nytApiHelper(0), nytApiHelper(1), nytApiHelper(2))
	 .done(function(a0, a1, a2) {
			var articles = [].concat(a0[0].response.docs, a1[0].response.docs, a2[0].response.docs);

			//Loop through Articles
			$.each(articles, function(i) {
				//For each object we set a new readlength property
				articles[i].readLength = parseInt(articles[i].word_count) / 275;
			});

			whileYouWait.Articles = articles;
	});
};

//api call for medium
whileYouWait.getMediumArticles = function() {
	$.ajax({
		url: 'http://159.203.6.167:3000/?q=http://medium.com',
		method: 'GET',
		dataType: 'jsonp'
	}).then(function(res) {
		whileYouWait.mediumArticles = res.payload;
		console.log(whileYouWait.mediumArticles);
		});
};

whileYouWait.displayMediumArticle = function(minFromNow) {
	var bestArticle = null;
	var bestReadLength = -1;

	$.each(whileYouWait.mediumArticles.value, function(i, article) {
		if (article.virtuals.readingTime <= minFromNow && article.virtuals.readingTime > bestReadLength) {
			bestArticle = article;
			bestReadLength = article.virtuals.readingTime;
		}
	});

	var ttcMinutesToTime = Math.ceil(minFromNow);
	console.log(ttcMinutesToTime);
	var mediumUserId = bestArticle.creatorId;
	var mediumUsername = whileYouWait.mediumArticles.references.User[mediumUserId].username;
	var bestArticleURL = 'https://medium.com/@' + mediumUsername + '/' + bestArticle.uniqueSlug;

	if (bestArticle) {
		$('.minFromNow').text('You have ' + ttcMinutesToTime + ' minutes until the next car arrives. Check out the article below!')
		$('.link').attr('href', bestArticleURL)
		$('h2').text(bestArticle.title);
		$('.article').text(bestArticle.virtuals.snippet);
	} else {
		$('.article').text('Please try again.');
	}
};

whileYouWait.displayArticle = function(minFromNow) {
	console.log(whileYouWait.Articles);
	var bestArticle = null;
	var bestReadLength = -1;

	$.each(whileYouWait.Articles, function(i, article) {
		if (article.readLength <= minFromNow && article.readLength > bestReadLength) {
			bestArticle = article;
			bestReadLength = article.readLength;
		}
	});

	var ttcMinutesToTime = Math.ceil(minFromNow);

	if (bestArticle) {
		$('.minFromNow').text('You have ' + ttcMinutesToTime + ' minutes until the next car arrives. Check out the article below!')
		$('.link').attr('href', bestArticle.web_url)
		$('h2').text(bestArticle.headline.main);
		$('.article').text(bestArticle.snippet);
	} else {
		$('p').text('Please try again.');
	}
};

whileYouWait.init = function() {
	$('label, #publicationChoice, select, #intersectionQuestion, #stopQuestion, #resetQuiz, #routeQuestion').hide();
	whileYouWait.clickOfBeginButton();
	whileYouWait.setupEventHandlers();
	whileYouWait.getUserLocationAndTTCRoutes();	
	whileYouWait.getNYTArticles();
	whileYouWait.getMediumArticles();
};

$(function() {
	whileYouWait.init();
	$('#resetQuiz').on('click', function() {
		window.location.reload(true);
	});
});