// An Apollo Link for using graphql-pro's Ably subscriptions
//
// @example Adding subscriptions to a HttpLink
//   // Load Ably and create a client
//   var Ably = require('ably')
//   // Be sure to create an API key with "Subscribe" and "Presence" permissions only,
//   // and use that limited API key here:
//   var ablyClient = new Ably.Realtime({ key: "yourapp.key:secret" })
//
//   // Build a combined link, initialize the client:
//   const ablyLink = new AblyLink({ably: ablyClient})
//   const link = ApolloLink.from([authLink, ablyLink, httpLink])
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

class AblyLink extends ApolloLink {
  constructor(options) {
    super()
    // Retain a handle to the Ably client
    this.ably = options.ably
  }

  request(operation, forward) {
    const clientName = "graphql-subscriber"
    const ably = this.ably

    const onSubscribe = (observer, subscriptionChannel) => {
      const ablyChannel = ably.channels.get(subscriptionChannel)
      // Register presence, so that we can detect empty channels and clean them up server-side
      if (ably.auth.clientId !== "*") {
        ablyChannel.presence.enter("subscribed")
      } else {
        ablyChannel.presence.enterClient(clientName, "subscribed")
      }
      // Subscribe for more update
      ablyChannel.subscribe("update", function(message) {
        var payload = message.data
        if (!payload.more) {
          // This is the end, the server says to unsubscribe
          if (ably.auth.clientId !== "*") {
            ablyChannel.presence.leave()
          } else {
            ablyChannel.presence.leaveClient(clientName)
          }
          ablyChannel.unsubscribe()
          observer.complete()
        }
        const result = payload.result
        if (result) {
          // Send the new response to listeners
          observer.next(result)
        }
      })
    }

    const onUnsubscribe = (subscriptionChannel) => {
      const ablyChannel = this.ably.channels.get(subscriptionChannel)
      console.log("Unsubscribing", subscriptionChannel, ablyChannel)
      ablyChannel.unsubscribe()
      if (ably.auth.clientId !== "*") {
        ablyChannel.presence.leave()
      } else {
        ablyChannel.presence.leaveClient(clientName)
      }
    }
    return wrapRequest(operation, forward, onSubscribe, onUnsubscribe)
  }
}

module.exports = AblyLink
