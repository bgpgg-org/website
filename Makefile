.PHONY: build clean serve

build:
	hugo --gc --minify

clean:
	rm -rf public

serve:
	hugo server --watch
