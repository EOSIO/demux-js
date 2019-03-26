#!/usr/bin/env bash

setup_git() {
  echo "  Setting up git configuration..."

  # Set the user name and email to match the API token holder
  # This will make sure the git commits will have the correct photo
  # and the user gets the credit for a checkin
  git config --global user.email "devops@block.one"
  git config --global user.name "blockone-devops"
  git config --global push.default matching

  # Get the credentials from a file
  git config credential.helper "store --file=.git/credentials"

  # This associates the API Key with the account
  echo "https://${GITHUB_API_KEY}:@github.com" > .git/credentials

  echo "✔ Set up git configuration"
}

clean_git() {
  echo "  Cleaning working tree from changes..."
  # Make sure that the workspace is clean
  # It could be "dirty" if
  # 1. package-lock.json is not aligned with package.json
  # 2. npm install is run
  git checkout -- .

  # Echo the status to the log so that we can see it is OK
  git status

  if $(git diff-index --quiet HEAD --); then
    echo "✔ Working tree clean"
    return 0
  fi

  echo "✖ Unable to clean working tree"
  echo "  Git status:"
  git status
  return 1
}

check_head() {
  echo "  Checking if HEAD aligns with master..."
  git fetch origin master:master
  if ! [ "$(git rev-parse HEAD)" = "$(git show-ref refs/heads/master --hash)" ]; then
    echo "✖ Current HEAD does not match head of master!"
    echo "  - HEAD: $(git rev-parse HEAD)"
    echo "  - master: $(git show-ref refs/heads/master --hash)"
    return 1
  fi
  echo "✔ Current HEAD matches head of master"
  return 0
}

check_version() {
  echo "  Checking if version of tag matches version in package.json..."
  if ! [ "$TRAVIS_TAG" = "$(npm run current-version --silent)" ]; then
    echo "✖ Tag does not match the version in package.json!"
    echo "  - Tag: $TRAVIS_TAG"
    echo "  - Version: $(npm run current-version --silent)"
    return 1
  fi
  echo "✔ Tag matches version in package.json"
  echo "  - Tag: $TRAVIS_TAG"
  echo "  - Version: $(npm run current-version --silent)"
  return 0
}

publish_edge() {
  echo "  Publishing edge release to NPM..."

  # Run the deploy build and increment the package versions
  new_version=${TRAVIS_BUILD_NUMBER}
  npm version prerelease -preid "${new_version}" -no-git-tag-version
  git commit -a -m "Updating version [skip ci]"
  cp .npmrc.template $HOME/.npmrc
  npm publish --tag edge

  echo "✔ Published edge release"
}

publish_latest() {
  echo "  Publishing new release to NPM..."

  cp .npmrc.template $HOME/.npmrc
  npm publish

  echo "✔ Published new release"
}
