var chai = require('chai')
  , oob = require('../../lib/exchange/oob');


describe('exchange.oob', function() {
  
  it('should be named oob', function() {
    expect(oob(function(){}, function(){}).name).to.equal('oob');
  });
  
  it('should throw if constructed without an authenticate callback', function() {
    expect(function() {
      oob();
    }).to.throw(TypeError, 'oauth2orize-mfa.oob exchange requires an authenticate callback');
  });
  
  it('should throw if constructed without an issue callback', function() {
    expect(function() {
      oob(function(){});
    }).to.throw(TypeError, 'oauth2orize-mfa.oob exchange requires an issue callback');
  });
  
  describe('authenticating and issuing an access token', function() {
    var response, err;

    before(function(done) {
      function authenticate(token, done) {
        if (token !== 'ey...') { return done(new Error('incorrect token argument')); }
        
        return done(null, { id: '1', username: 'johndoe' })
      }
      
      function issue(client, user, oobCode, token, scope, done) {
        if (client.id !== 'c123') { return done(new Error('incorrect client argument')); }
        if (user.username !== 'johndoe') { return done(new Error('incorrect user argument')); }
        if (oobCode !== 'a1b2c3') { return done(new Error('incorrect oobCode argument')); }
        if (token !== 'ey...') { return done(new Error('incorrect token argument')); }
        
        return done(null, 's3cr1t')
      }
      
      chai.connect.use(oob(authenticate, issue))
        .req(function(req) {
          req.user = { id: 'c123', name: 'Example' };
          req.body = { mfa_token: 'ey...', oob_code: 'a1b2c3', scope: 'execute' };
        })
        .end(function(res) {
          response = res;
          done();
        })
        .dispatch();
    });
    
    it('should respond with headers', function() {
      expect(response.getHeader('Content-Type')).to.equal('application/json');
      expect(response.getHeader('Cache-Control')).to.equal('no-store');
      expect(response.getHeader('Pragma')).to.equal('no-cache');
    });
    
    it('should respond with body', function() {
      expect(response.body).to.equal('{"access_token":"s3cr1t","token_type":"Bearer"}');
    });
  });
  
  describe('handling a request without an MFA token', function() {
    var response, err;

    before(function(done) {
      function authenticate(token, done) {
        return done(null, { id: '0' })
      }
      
      function issue(client, user, oobCode, token, done) {
        return done(null, '.ignore')
      }
      
      chai.connect.use(oob(authenticate, issue))
        .req(function(req) {
          req.user = { id: 'c123', name: 'Example' };
          req.body = { oob_code: 'a1b2c3' };
        })
        .next(function(e) {
          err = e;
          done();
        })
        .dispatch();
    });
    
    it('should error', function() {
      expect(err).to.be.an.instanceOf(Error);
      expect(err.constructor.name).to.equal('TokenError');
      expect(err.message).to.equal('Missing required parameter: mfa_token');
      expect(err.code).to.equal('invalid_request');
      expect(err.status).to.equal(400);
    });
  });

  describe('handling a request with bad typed MFA token', function() {
    var response, err;

    before(function(done) {
      function authenticate(token, done) {
        return done(null, { id: '0' })
      }

      function issue(client, user, oobCode, token, done) {
        return done(null, '.ignore')
      }

      chai.connect.use(oob(authenticate, issue))
        .req(function(req) {
          req.user = { id: 'c123', name: 'Example' };
          req.body = { oob_code: 'a1b2c3', mfa_token: { foo: 'bar' } };
        })
        .next(function(e) {
          err = e;
          done();
        })
        .dispatch();
    });

    it('should error', function() {
      expect(err).to.be.an.instanceOf(Error);
      expect(err.constructor.name).to.equal('TokenError');
      expect(err.message).to.equal('mfa_token must be a string');
      expect(err.code).to.equal('invalid_request');
      expect(err.status).to.equal(400);
    });
  });

  describe('handling a request without an OOB code', function() {
    var response, err;

    before(function(done) {
      function authenticate(token, done) {
        return done(null, { id: '0' })
      }
      
      function issue(client, user, oobCode, token, done) {
        return done(null, '.ignore')
      }
      
      chai.connect.use(oob(authenticate, issue))
        .req(function(req) {
          req.user = { id: 'c123', name: 'Example' };
          req.body = { mfa_token: 'ey...' };
        })
        .next(function(e) {
          err = e;
          done();
        })
        .dispatch();
    });
    
    it('should error', function() {
      expect(err).to.be.an.instanceOf(Error);
      expect(err.constructor.name).to.equal('TokenError');
      expect(err.message).to.equal('Missing required parameter: oob_code');
      expect(err.code).to.equal('invalid_request');
      expect(err.status).to.equal(400);
    });
  });

  describe('handling a request with a bad typed OOB code', function() {
    var response, err;

    before(function(done) {
      function authenticate(token, done) {
        return done(null, { id: '0' })
      }

      function issue(client, user, oobCode, token, done) {
        return done(null, '.ignore')
      }

      chai.connect.use(oob(authenticate, issue))
        .req(function(req) {
          req.user = { id: 'c123', name: 'Example' };
          req.body = { oob_code: { foo: 'bar' }, mfa_token: 'ey...' };
        })
        .next(function(e) {
          err = e;
          done();
        })
        .dispatch();
    });

    it('should error', function() {
      expect(err).to.be.an.instanceOf(Error);
      expect(err.constructor.name).to.equal('TokenError');
      expect(err.message).to.equal('oob_code must be a string');
      expect(err.code).to.equal('invalid_request');
      expect(err.status).to.equal(400);
    });
  });

  describe('authenticating and issuing with info and body', function() {
    var response, err;

    before(function(done) {
      function authenticate(token, done) {
        if (token !== 'ey...') { return done(new Error('incorrect token argument')); }

        return done(null, { id: '1', username: 'johndoe' }, { provider: 'XXX' })
      }

      function issue(client, user, oobCode, token, body, info, done) {
        if (client.id !== 'c123') { return done(new Error('incorrect client argument')); }
        if (user.username !== 'johndoe') { return done(new Error('incorrect user argument')); }
        if (oobCode !== 'a1b2c3') { return done(new Error('incorrect oobCode argument')); }
        if (token !== 'ey...') { return done(new Error('incorrect token argument')); }
        if (body.mfa_token !== 'ey...' || body.oob_code !== 'a1b2c3' || body.scope !== 'execute'  ) {
          return done(new Error('incorrect body argument'));
        }
        if (info.provider !== 'XXX') { return done(new Error('incorrect info argument')); }

        return done(null, 's3cr1t')
      }

      chai.connect.use(oob(authenticate, issue))
        .req(function(req) {
          req.user = { id: 'c123', name: 'Example' };
          req.body = { mfa_token: 'ey...', oob_code: 'a1b2c3', scope: 'execute' };
        })
        .end(function(res) {
          response = res;
          done();
        })
        .dispatch();
    });

    it('should respond with headers', function() {
      expect(response.getHeader('Content-Type')).to.equal('application/json');
      expect(response.getHeader('Cache-Control')).to.equal('no-store');
      expect(response.getHeader('Pragma')).to.equal('no-cache');
    });

    it('should respond with body', function() {
      expect(response.body).to.equal('{"access_token":"s3cr1t","token_type":"Bearer"}');
    });
  });

});
