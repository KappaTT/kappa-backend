( find ./src -name '*.js*' -print0 | xargs -0 cat ) | wc -l
( find ./tests -name '*.js*' -print0 | xargs -0 cat ) | wc -l