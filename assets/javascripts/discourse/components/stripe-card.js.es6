import { ajax } from 'discourse/lib/ajax';
import { getRegister } from 'discourse-common/lib/get-owner';

const { computed: { alias }, observer } = Ember

export default Ember.Component.extend({

  routing: Ember.inject.service('-routing'),
  params: alias('routing.router.currentState.routerJsState.fullQueryParams'),

  donateAmounts: [
    { value: 'consumer-defender-1', name: 'Consumer Defender: $1.00/quarter'},
    { value: 'consumer-defender-3', name: 'Consumer Defender: $3.00/quarter'},
    { value: 'consumer-defender-6', name: 'Consumer Defender: $6.00/quarter'},
    { value: 'consumer-defender-9', name: 'Consumer Defender: $9.00/quarter'},
    { value: 'consumer-defender-12', name: 'Consumer Defender: $12.00/quarter'},
  ],
  result: [],
  amount: null,
  selectedOption:null,
  stripe: null,
  transactionInProgress: null,
  settings: null,

  consumerDefenderWithMembership: function() {
    return this.get('params.plan') == 'consumer-defender-with-membership';
  }.property('params'),

  init() {
    this._super();
    this.set('anon', (Discourse.User.current() == null));
    this.set('settings', getRegister(this).lookup('site-settings:main'));
    this.set('create_accounts', this.get('anon') && this.get('settings').discourse_donations_enable_create_accounts);
    this.set('stripe', Stripe(this.get('settings').discourse_donations_public_key));
    this.set('amount', this.get('donateAmounts.firstObject'));
  },

  card: function() {
    let elements = this.get('stripe').elements();
    return elements.create('card', {
      hidePostalCode: this.get('settings').discourse_donations_hide_zip_code
    });
  }.property('stripe'),

  didInsertElement() {
    this._super();
    this.get('card').mount('#card-element');
  },

  setSuccess() {
    this.set('paymentSuccess', true);
  },

  endTranscation() {
    this.set('transactionInProgress', false);
  },

  concatMessages(messages) {
    this.set('result', this.get('result').concat(messages));
  },

  actions: {
    submitStripeCard() {
      let self = this;

      self.set('transactionInProgress', true);

      this.get('stripe').createToken(this.get('card')).then(data => {

        self.set('result', []);

        if (data.error) {
          self.set('result', data.error.message);
          self.set('transactionInProgress', false);
        }
        else {

          let params = {
            stripeToken: data.token.id,
            email: self.get('email'),
            username: self.get('username'),
            create_account: self.get('create_accounts')
          };

          if(this.get('params.plan')) {
            params.plan = this.get('params.plan');
          }
          else {
            params.amount = self.get('amount');
            console.log("amount", self.get('amount'));
          }

          if(!self.get('paymentSuccess')) {
            ajax('/charges', { data: params, method: 'post' }).then(data => {
              self.concatMessages(data.messages);
              self.endTranscation();
              if(data.success) {
                self.setSuccess();
              }
            });
          }
        }
      });
    },
      selectOption(selectedOption) {
          this.set('selectedOption', selectedOption);
          this.set('amount', selectedOption);
          console.log("change ", selectedOption)
      }
  }
});
