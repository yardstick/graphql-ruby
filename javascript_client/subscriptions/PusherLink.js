// An Apollo Link for using graphql-pro's Pusher subscriptions
//
// @example Adding subscriptions to a HttpLink
//   // Load Pusher and create a client
//   import Pusher from "pusher-js"
//   var pusherClient = new Pusher("your-app-key", { cluster: "us2" })
//
//   // Build a combined link, initialize the client:
//   const pusherLink = new PusherLink({pusher: pusherClient})
//   const link = ApolloLink.from([authLink, pusherLink, httpLink])
//   const client = new ApolloClient(link: link, ...)
//
// @example Building a subscription, then subscribing to it
//  subscription = client.subscribe({
//    variables: { room: roomName},
//    query: gql`
//      subscription MessageAdded($room: String!) {
//        messageWasAdded(room: $room) {
//          room {
//            messages {
//              id
//              body
//              author {
//                screenname
//              }
//            }
//          }
//        }
//      }
//       `
//   })
//
//   subscription.subscribe({ next: ({data, errors}) => {
//     // Do something with `data` and/or `errors`
//   }})
//
var ApolloLink = require("apollo-link").ApolloLink
var wrapRequest = require("./linkHelpers").wrapRequest

class PusherLink extends ApolloLink {
  constructor(options) {
    super()
    // Retain a handle to the Pusher client
    this.pusher = options.pusher
  }

  request(operation, forward) {
    const pusher = this.pusher
    const onSubscribe = function(observer, subscriptionChannel) {
      // Set up the pusher subscription for updates from the server
      const pusherChannel = pusher.subscribe(subscriptionChannel)
      // Subscribe for more update
      pusherChannel.bind("update", function(payload) {
        if (!payload.more) {
          // This is the end, the server says to unsubscribe
          pusher.unsubscribe(subscriptionChannel)
          observer.complete()
        }
        const result = payload.result
        if (result) {
          // Send the new response to listeners
          observer.next(result)
        }
      })
    }

    const onUnsubscribe = function(subscriptionChannel) {
      pusher.unsubscribe(subscriptionChannel)
    }
    return wrapRequest(operation, forward, onSubscribe, onUnsubscribe)
  }
}

module.exports = PusherLink
