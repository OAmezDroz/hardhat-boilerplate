import React from "react";

// We'll use ethers to interact with the Ethereum network and our contract
import { ethers } from "ethers";

// We import the contract's artifacts and address here, as we are going to be
// using them with ethers
import TokenArtifact from "../contracts/Token.json";
import contractAddress from "../contracts/contract-address.json";
import TravelTrust from "../contracts/TravelTrust.json";

// All the logic of this dapp is contained in the Dapp component.
// These other components are just presentational ones: they don't have any
// logic. They just render HTML.
import { NoWalletDetected } from "./NoWalletDetected";
import { ConnectWallet } from "./ConnectWallet";
import { Loading } from "./Loading";

// This is the default id used by the Hardhat Network
const HARDHAT_NETWORK_ID = "31337";

// This is an error code that indicates that the user canceled a transaction
const ERROR_CODE_TX_REJECTED_BY_USER = 4001;

// This component is in charge of doing these things:
//   1. It connects to the user's wallet
//   2. Initializes ethers and the Token contract
//   3. Polls the user balance to keep it updated.
//   4. Transfers tokens by sending transactions
//   5. Renders the whole application
//
// Note that (3) and (4) are specific of this sample application, but they show
// you how to keep your Dapp and contract's state in sync,  and how to send a
// transaction.
export class Dapp extends React.Component {
  constructor(props) {
    super(props);

    // We store multiple things in Dapp's state.
    // You don't need to follow this pattern, but it's an useful example.
    this.initialState = {
      // The info of the token (i.e. It's Name and symbol)
      tokenData: undefined,
      // The user's address and balance
      selectedAddress: undefined,
      balance: undefined,
      // The ID about transactions being sent, and any possible error with them
      txBeingSent: undefined,
      transactionError: undefined,
      networkError: undefined,
      offer_address: undefined,
      offer_description: undefined,
      offer_price: undefined,
      offer_available: undefined,
      userInputDescription: "",
      userInputPrice: "",
      offers: [],
    };

    this.state = this.initialState;
  }

  _handleDescriptionChange = (event) => {
    this.setState({ userInputDescription: event.target.value });
  };

  _handlePriceChange = (event) => {
    this.setState({ userInputPrice: event.target.value });
  };

  render() {
    // Ethereum wallets inject the window.ethereum object. If it hasn't been
    // injected, we instruct the user to install a wallet.
    if (window.ethereum === undefined) {
      return <NoWalletDetected />;
    }

    // The next thing we need to do, is to ask the user to connect their wallet.
    // When the wallet gets connected, we are going to save the users's address
    // in the component's state. So, if it hasn't been saved yet, we have
    // to show the ConnectWallet component.
    //
    // Note that we pass it a callback that is going to be called when the user
    // clicks a button. This callback just calls the _connectWallet method.
    if (!this.state.selectedAddress) {
      return (
        <ConnectWallet
          connectWallet={() => this._connectWallet()}
          networkError={this.state.networkError}
          dismiss={() => this._dismissNetworkError()}
        />
      );
    }

    // If the token data or the user's balance hasn't loaded yet, we show
    // a loading component.
    if (!this.state.tokenData) {
      return <Loading />;
    }

    const offerList = this.state.offers.map((offer, index) => (
      <div key={index} className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">Offer ID: {offer.id}</h5>
          <p className="card-text">
            <b>Description:</b> {offer.description}
          </p>
          <p className="card-text">
            <b>Price:</b> {offer.price} ETH
          </p>
          <p className="card-text">
            <b>Offerer Address:</b> {offer.address}
          </p>
          <p className="card-text">
            <b>Available:</b> {offer.available ? "Yes" : "No"}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => this._buyOffer(offer.id, offer.price)}
            disabled={!offer.available}
          >
            Buy Offer
          </button>
        </div>
      </div>
    ));

    // If everything is loaded, we render the application.
    return (
      <div className="container p-4">
        <div className="row">
          <div className="col-12">
            <h1>TravelTrust</h1>
            <p>
              Welcome <b>{this.state.selectedAddress}</b>,merry christmas and
              happy new year!
            </p>
          </div>
        </div>
        <hr />
        <div className="row">
          <div className="col-12" id="marketplace">
            <div>
              <div class="input-group mb-3">
                <input
                  type="text"
                  placeholder="Description"
                  class="form-control"
                  value={this.state.userInputDescription}
                  onChange={this._handleDescriptionChange}
                />
              </div>
              <div class="input-group mb-3">
                <div class="input-group-prepend">
                  <span class="input-group-text">ETH</span>
                </div>
                <input
                  type="text"
                  class="form-control"
                  aria-label="Amount"
                  value={this.state.userInputPrice}
                  onChange={this._handlePriceChange}
                />
                <button
                  class="btn btn-primary"
                  onClick={() => {
                    if (
                      this.state.userInputPrice > 0 &&
                      this.state.userInputDescription.length > 0
                    ) {
                      this._setTravelTrustOffer(
                        this.state.userInputDescription,
                        this.state.userInputPrice
                      );
                    }
                  }}
                >
                  Set Offer
                </button>
              </div>
            </div>
            <div>
              <button
                class="btn btn-secondary"
                onClick={() => this._getTravelTrustOffers()}
              >
                Refresh Offers
              </button>
              <div>{offerList}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  async _connectWallet() {
    // This method is run when the user clicks the Connect. It connects the
    // dapp to the user's wallet, and initializes it.

    // To connect to the user's wallet, we have to run this method.
    // It returns a promise that will resolve to the user's address.
    const [selectedAddress] = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    // Once we have the address, we can initialize the application.

    // First we check the network
    this._checkNetwork();

    this._initialize(selectedAddress);

    // We reinitialize it whenever the user changes their account.
    window.ethereum.on("accountsChanged", ([newAddress]) => {
      // `accountsChanged` event can be triggered with an undefined newAddress.
      // This happens when the user removes the Dapp from the "Connected
      // list of sites allowed access to your addresses" (Metamask > Settings > Connections)
      // To avoid errors, we reset the dapp state
      if (newAddress === undefined) {
        return this._resetState();
      }

      this._initialize(newAddress);
    });
  }

  _initialize(userAddress) {
    // This method initializes the dapp

    // We first store the user's address in the component's state
    this.setState({
      selectedAddress: userAddress,
    });

    // Then, we initialize ethers, fetch the token's data, and start polling
    // for the user's balance.

    // Fetching the token data and the user's balance are specific to this
    // sample project, but you can reuse the same initialization pattern.
    this._initializeEthers();
    this.initializeTravelTrust();
    this._getTravelTrustOffers();
    this._getTokenData();
  }

  async _initializeEthers() {
    // We first initialize ethers by creating a provider using window.ethereum
    this._provider = new ethers.providers.Web3Provider(window.ethereum);

    // Then, we initialize the contract using that provider and the token's
    // artifact. You can do this same thing with your contracts.
    this._token = new ethers.Contract(
      contractAddress.Token,
      TokenArtifact.abi,
      this._provider.getSigner(0)
    );
  }

  async initializeTravelTrust() {
    // Get the network ID
    //const networkId = await this._provider.getNetwork().then((network) => network.chainId);

    // Get the deployed address of the TravelTrust contract
    //const deployedAddress = TravelTrust.networks[networkId].address;

    // Initialize the TravelTrust contract
    this._travelTrust = new ethers.Contract(
      contractAddress.TravelTrust,
      TravelTrust.abi,
      this._provider.getSigner(0)
    );
  }

  async _buyOffer(offerId, price) {
    try {
      const transaction = await this._travelTrust.buyOffer(offerId, {
        value: ethers.utils.parseEther(price),
      });
      await transaction.wait();

      // Update offers after purchase
      this._getTravelTrustOffers();
    } catch (error) {
      console.error("Error buying offer:", error);
      this.setState({ transactionError: error });
    }
  }

  /*async _getTravelTrustOffer() {
    // Fill the offers array with the offers from the TravelTrust contract until there are no more offers

    const offer = await this._travelTrust.getOffer(0);
    console.log(offer);
    this.setState({
      offer_address: offer[0],
      offer_description: offer[1],
      offer_price: ethers.utils.formatEther(offer[2]),
      offer_available: offer[3] ? "Yes" : "No",
    });
  }*/

  async _getTravelTrustOffers() {
    const offers = [];
    let id = 0;
    let offerExists = true;

    while (offerExists) {
      try {
        const offer = await this._travelTrust.getOffer(id);
        console.log(offer[3]);
        offers.push({
          id: id,
          address: offer[0],
          description: offer[1],
          price: ethers.utils.formatEther(ethers.BigNumber.from(offer[2])) ,
          available: offer[3],
        });
        id++;
      } catch (error) {
        offerExists = false;
      }
    }

    this.setState({ offers });
  }

  async _setTravelTrustOffer(description, price) {
    // Ensure the price is in wei
    const priceInWei = ethers.utils.parseEther(price.toString());

    // Call the createOffer function of the TravelTrust contract
    const transaction = await this._travelTrust.createOffer(
      description,
      priceInWei
    );

    // Wait for the transaction to be mined
    await transaction.wait();
  }

  // The next two methods just read from the contract and store the results
  // in the component state.
  async _getTokenData() {
    const name = await this._token.name();
    const symbol = await this._token.symbol();

    this.setState({ tokenData: { name, symbol } });
  }

  // This method just clears part of the state.
  _dismissTransactionError() {
    this.setState({ transactionError: undefined });
  }

  // This method just clears part of the state.
  _dismissNetworkError() {
    this.setState({ networkError: undefined });
  }

  // This is an utility method that turns an RPC error into a human readable
  // message.
  _getRpcErrorMessage(error) {
    if (error.data) {
      return error.data.message;
    }

    return error.message;
  }

  // This method resets the state
  _resetState() {
    this.setState(this.initialState);
  }

  async _switchChain() {
    const chainIdHex = `0x${HARDHAT_NETWORK_ID.toString(16)}`;
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
    await this._initialize(this.state.selectedAddress);
  }

  // This method checks if the selected network is Localhost:8545
  _checkNetwork() {
    if (window.ethereum.networkVersion !== HARDHAT_NETWORK_ID) {
      this._switchChain();
    }
  }
}
